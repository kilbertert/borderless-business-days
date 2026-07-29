import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addSharedBusinessDays,
  analyzeRange,
  CalendarValidationError,
  countriesForCodes,
  findSharedWindows,
  loadDataset,
  summarizeDays,
  validateBusinessDayAmount,
  validateCountries,
  validateDatasetDate,
  validateRange,
  validateWindowRequest,
} from "./calendar.mjs";
import { loadConfig } from "./config.mjs";
import { extractKeyId, KeyAccessError, KeyStore } from "./storage.mjs";

const POST_ROUTES = new Set(["/v1/business-days/analyze", "/v1/business-days/add", "/v1/business-days/windows"]);

class RequestError extends Error {
  constructor(message, code = "invalid_request", statusCode = 400) {
    super(message);
    this.name = "RequestError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function jsonResponse(response, statusCode, payload, requestId, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-request-id": requestId,
    ...extraHeaders,
  });
  response.end(body);
}

async function readJson(request, maximumBodyBytes) {
  const contentType = request.headers["content-type"] ?? "";
  const mediaType = String(contentType).split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new RequestError("Content-Type must be application/json.", "unsupported_media_type", 415);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes) throw new RequestError("Request body is too large.", "body_too_large", 413);
    chunks.push(chunk);
  }
  if (chunks.length === 0) throw new RequestError("A JSON request body is required.");
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("object required");
    return value;
  } catch {
    throw new RequestError("Request body must contain a valid JSON object.", "invalid_json", 400);
  }
}

function apiKeyFromRequest(request) {
  const direct = request.headers["x-api-key"];
  if (typeof direct === "string" && direct) return direct.trim();
  const authorization = request.headers.authorization;
  const match = typeof authorization === "string" ? /^Bearer\s+(.+)$/i.exec(authorization) : undefined;
  if (match?.[1]) return match[1].trim();
  throw new KeyAccessError("Provide an API key using Authorization: Bearer or X-API-Key.", "missing_api_key", 401);
}

function keyMeta(record) {
  return {
    id: record.id,
    status: record.status,
    expiresAt: record.expires_at,
    requestLimit: record.request_limit,
    requestCount: record.request_count,
    requestRemaining: Math.max(0, record.request_limit - record.request_count),
  };
}

function quotaHeaders(record) {
  return {
    "x-quota-limit": String(record.request_limit),
    "x-quota-remaining": String(Math.max(0, record.request_limit - record.request_count)),
    "x-quota-expires-at": record.expires_at,
  };
}

function datasetMeta(dataset) {
  return { generatedAt: dataset.generatedAt, years: dataset.years, attribution: dataset.attribution };
}

function conflictRows(days) {
  return days.filter((day) => !day.weekend && day.conflicts.length > 0).map((day) => ({ date: day.date, conflicts: day.conflicts }));
}

function normalizeBoolean(value, name) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new RequestError(`${name} must be a boolean.`);
  return value;
}

function normalizeInteger(value, name) {
  if (!Number.isInteger(value)) throw new RequestError(`${name} must be an integer.`);
  return value;
}

function openApiDocument(config) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Borderless Business Days API",
      version: "1.0.0-pilot",
      description: "B2B pilot API for shared business-day calculations across public holiday calendars.",
    },
    servers: [{ url: `http://${config.host}:${config.port}` }],
    components: {
      securitySchemes: {
        bearerApiKey: { type: "http", scheme: "bearer", bearerFormat: "BBD API Key" },
        headerApiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
    paths: {
      "/healthz": { get: { summary: "Service health", responses: { 200: { description: "Healthy" } } } },
      "/v1/countries": { get: { summary: "Supported markets", responses: { 200: { description: "Market list" } } } },
      "/v1/account": { get: { summary: "Current API key quota", security: [{ bearerApiKey: [] }, { headerApiKey: [] }], responses: { 200: { description: "Account status" } } } },
      "/v1/business-days/analyze": { post: { summary: "Analyze a date range", security: [{ bearerApiKey: [] }, { headerApiKey: [] }], responses: { 200: { description: "Range analysis" } } } },
      "/v1/business-days/add": { post: { summary: "Add or subtract shared business days", security: [{ bearerApiKey: [] }, { headerApiKey: [] }], responses: { 200: { description: "Resolved date" } } } },
      "/v1/business-days/windows": { post: { summary: "Find uninterrupted shared-business-day windows", security: [{ bearerApiKey: [] }, { headerApiKey: [] }], responses: { 200: { description: "Candidate windows" } } } },
    },
  };
}

function createRateLimiter(limitPerMinute, { code, message }) {
  const buckets = new Map();
  return (identity) => {
    const now = Date.now();
    if (buckets.size >= 10_000) {
      for (const [id, bucket] of buckets) if (now - bucket.startedAt >= 60_000) buckets.delete(id);
    }
    const existing = buckets.get(identity);
    if (!existing || now - existing.startedAt >= 60_000) {
      if (!existing && buckets.size >= 10_000) throw new RequestError(message, code, 429);
      buckets.set(identity, { startedAt: now, count: 1 });
      return;
    }
    if (existing.count >= limitPerMinute) throw new RequestError(message, code, 429);
    existing.count += 1;
  };
}

function normalizedAddress(value) {
  if (typeof value !== "string") return "unknown";
  const trimmed = value.trim();
  if (trimmed.startsWith("::ffff:") && isIP(trimmed.slice(7)) === 4) return trimmed.slice(7);
  return trimmed || "unknown";
}

function requestSource(request, trustedProxyAddresses) {
  const remoteAddress = normalizedAddress(request.socket.remoteAddress);
  const cloudflareAddress = request.headers["cf-connecting-ip"];
  if (trustedProxyAddresses.has(remoteAddress)
    && typeof cloudflareAddress === "string"
    && isIP(cloudflareAddress.trim()) !== 0) {
    return cloudflareAddress.trim();
  }
  return remoteAddress;
}

export function createApiServer({ config, dataset, store, logger = console }) {
  const trustedProxyAddresses = new Set((config.trustedProxyAddresses ?? []).map(normalizedAddress));
  const preAuthRateLimit = createRateLimiter(config.preAuthRateLimitPerMinute ?? Math.max(120, config.rateLimitPerMinute * 4), {
    code: "request_rate_limit_exceeded",
    message: "Too many requests from this client. Try again shortly.",
  });
  const rateLimit = createRateLimiter(config.rateLimitPerMinute, {
    code: "rate_limit_exceeded",
    message: "Too many requests for this API key. Try again shortly.",
  });

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    let statusCode = 500;
    let keyId;
    let pathname = "/";

    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      pathname = url.pathname;

      if (request.method === "GET" && pathname === "/healthz") {
        statusCode = 200;
        return jsonResponse(response, statusCode, { status: "ok", service: "borderless-business-days-api", time: new Date().toISOString(), dataset: datasetMeta(dataset) }, requestId);
      }
      if (request.method === "GET" && pathname === "/openapi.json") {
        statusCode = 200;
        return jsonResponse(response, statusCode, openApiDocument(config), requestId);
      }
      if (request.method === "GET" && pathname === "/v1/countries") {
        statusCode = 200;
        return jsonResponse(response, statusCode, { data: dataset.countries.map(({ code, name }) => ({ code, name })), meta: { dataset: datasetMeta(dataset) } }, requestId);
      }
      const accountRoute = request.method === "GET" && pathname === "/v1/account";
      const calculationRoute = request.method === "POST" && POST_ROUTES.has(pathname);
      if (!accountRoute && !calculationRoute) throw new RequestError("Route not found.", "not_found", 404);

      preAuthRateLimit(requestSource(request, trustedProxyAddresses));
      const apiKey = apiKeyFromRequest(request);
      keyId = extractKeyId(apiKey);
      const verified = store.verify(apiKey);
      rateLimit(verified.id);

      if (accountRoute) {
        statusCode = 200;
        return jsonResponse(response, statusCode, { data: { customerName: verified.customer_name, customerRef: verified.customer_ref, key: keyMeta(verified) } }, requestId, quotaHeaders(verified));
      }
      if (verified.request_count >= verified.request_limit) {
        throw new KeyAccessError("The API key request allowance is exhausted.", "quota_exhausted", 429);
      }

      const body = await readJson(request, config.maximumBodyBytes);
      const countryCodes = validateCountries(dataset, body.countries);
      const markets = countriesForCodes(dataset, countryCodes);
      let calculate;

      if (pathname === "/v1/business-days/analyze") {
        const start = validateDatasetDate(dataset, body.start);
        const end = validateDatasetDate(dataset, body.end);
        const includeDays = normalizeBoolean(body.includeDays, "includeDays");
        validateRange(dataset, start, end);
        calculate = () => {
          const days = analyzeRange(dataset, countryCodes, start, end);
          return { markets, start, end, summary: summarizeDays(days), conflicts: conflictRows(days), ...(includeDays ? { days } : {}) };
        };
      } else if (pathname === "/v1/business-days/add") {
        const start = validateDatasetDate(dataset, body.start);
        const amount = normalizeInteger(body.amount, "amount");
        validateBusinessDayAmount(amount);
        calculate = () => {
          const calculation = addSharedBusinessDays(dataset, countryCodes, start, amount);
          return { markets, start, amount, result: calculation.result, examinedCalendarDays: calculation.examined.length, conflicts: conflictRows(calculation.examined) };
        };
      } else if (pathname === "/v1/business-days/windows") {
        const start = validateDatasetDate(dataset, body.start);
        const horizonDays = normalizeInteger(body.horizonDays, "horizonDays");
        const businessDays = normalizeInteger(body.businessDays, "businessDays");
        validateWindowRequest(dataset, start, horizonDays, businessDays);
        calculate = () => {
          const result = findSharedWindows(dataset, countryCodes, start, horizonDays, businessDays);
          return { markets, start, end: result.end, horizonDays, businessDays, windows: result.windows, summary: summarizeDays(result.days) };
        };
      }

      const data = calculate();
      const consumed = store.consume(apiKey, pathname);
      statusCode = 200;
      return jsonResponse(response, statusCode, { data, meta: { requestId, key: keyMeta(consumed), dataset: datasetMeta(dataset) } }, requestId, quotaHeaders(consumed));
    } catch (error) {
      const calendarError = error instanceof CalendarValidationError;
      const known = error instanceof RequestError || error instanceof KeyAccessError || calendarError;
      statusCode = calendarError ? 400 : known ? error.statusCode : 500;
      if (!known) logger.error({ event: "api_error", requestId, pathname, message: error instanceof Error ? error.message : String(error) });
      const code = calendarError ? "invalid_request" : known ? error.code : "internal_error";
      const retryableRateLimit = code === "rate_limit_exceeded" || code === "request_rate_limit_exceeded";
      return jsonResponse(response, statusCode, { error: { code, message: known ? error.message : "The service could not complete the request.", requestId } }, requestId, retryableRateLimit ? { "retry-after": "60" } : {});
    } finally {
      logger.info({ event: "api_request", requestId, method: request.method, pathname, statusCode, keyId: keyId ?? null, durationMs: Date.now() - startedAt });
    }
  });

  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
  return server;
}

export function startApiServer(config = loadConfig()) {
  const dataset = loadDataset(config.datasetPath);
  const store = new KeyStore(config);
  const logger = {
    info(value) { console.info(JSON.stringify(value)); },
    error(value) { console.error(JSON.stringify(value)); },
  };
  const server = createApiServer({ config, dataset, store, logger });
  server.listen(config.port, config.host, () => {
    logger.info({ event: "api_started", host: config.host, port: config.port, databasePath: config.databasePath, datasetGeneratedAt: dataset.generatedAt });
  });

  const shutdown = (signal) => {
    logger.info({ event: "api_stopping", signal });
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return { server, store, dataset };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  process.umask(0o077);
  startApiServer();
}
