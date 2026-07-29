import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadDataset } from "../calendar.mjs";
import { createApiServer } from "../server.mjs";
import { KeyStore } from "../storage.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(testDirectory, "../../src/data/holidays.json");
const silentLogger = { info() {}, error() {} };

async function withServer({ configOverrides = {}, requestLimit = 2 } = {}, callback) {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-api-server-"));
  let server;
  let store;

  try {
    const config = {
      host: "127.0.0.1",
      port: 0,
      databasePath: path.join(directory, "api.sqlite3"),
      datasetPath,
      keyPepper: "test-pepper-that-is-longer-than-thirty-two-characters",
      preAuthRateLimitPerMinute: 100,
      rateLimitPerMinute: 100,
      maximumBodyBytes: 32_768,
      ...configOverrides,
    };
    const dataset = loadDataset(datasetPath);
    store = new KeyStore(config);
    const issued = store.issueKey({ customerName: "Server Test", days: 1, requestLimit });
    server = createApiServer({ config, dataset, store, logger: silentLogger });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    return await callback({ baseUrl, config, issued, store });
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("serves validated calculations and enforces quota semantics", async () => {
  await withServer({}, async ({ baseUrl, issued, store }) => {
    const headers = { authorization: `Bearer ${issued.apiKey}`, "content-type": "application/json" };

    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);

    const missingRoute = await fetch(`${baseUrl}/v1/missing`, { method: "POST" });
    assert.equal(missingRoute.status, 404);
    assert.equal((await missingRoute.json()).error.code, "not_found");

    const unauthorized = await fetch(`${baseUrl}/v1/account`);
    assert.equal(unauthorized.status, 401);

    const invalidMediaType = await fetch(`${baseUrl}/v1/business-days/analyze`, {
      method: "POST",
      headers: { authorization: `Bearer ${issued.apiKey}`, "content-type": "application/jsonfoo" },
      body: "{}",
    });
    assert.equal(invalidMediaType.status, 415);

    const invalidCountry = await fetch(`${baseUrl}/v1/business-days/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["XX"], start: "2026-01-01", end: "2026-01-05" }),
    });
    assert.equal(invalidCountry.status, 400);
    assert.equal((await invalidCountry.json()).error.code, "invalid_request");
    assert.equal(store.getKey(issued.record.id).request_count, 0);

    const analyze = await fetch(`${baseUrl}/v1/business-days/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["US", "GB"], start: "2026-01-01", end: "2026-01-05" }),
    });
    assert.equal(analyze.status, 200);
    assert.equal(analyze.headers.get("x-quota-remaining"), "1");
    assert.equal((await analyze.json()).data.summary.sharedBusinessDays, 2);

    const account = await fetch(`${baseUrl}/v1/account`, { headers: { authorization: `Bearer ${issued.apiKey}` } });
    assert.equal(account.status, 200);
    assert.equal((await account.json()).data.key.requestCount, 1);

    const add = await fetch(`${baseUrl}/v1/business-days/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["US"], start: "2026-01-01", amount: 1 }),
    });
    assert.equal(add.status, 200);
    assert.equal(add.headers.get("x-quota-remaining"), "0");

    const exhausted = await fetch(`${baseUrl}/v1/business-days/windows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["US", "GB"], start: "2026-01-01", horizonDays: 30, businessDays: 3 }),
    });
    assert.equal(exhausted.status, 429);
    assert.equal(exhausted.headers.get("retry-after"), null);
    assert.equal((await exhausted.json()).error.code, "quota_exhausted");

    store.setStatus(issued.record.id, "revoked");
    const revoked = await fetch(`${baseUrl}/v1/account`, { headers: { "x-api-key": issued.apiKey } });
    assert.equal(revoked.status, 403);
  });
});

test("enforces separate pre-authentication and API key rate limits", async () => {
  await withServer({ configOverrides: { preAuthRateLimitPerMinute: 1 } }, async ({ baseUrl }) => {
    const first = await fetch(`${baseUrl}/v1/account`);
    assert.equal(first.status, 401);
    const limited = await fetch(`${baseUrl}/v1/account`);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await limited.json()).error.code, "request_rate_limit_exceeded");
  });

  await withServer({ configOverrides: { rateLimitPerMinute: 1 } }, async ({ baseUrl, issued }) => {
    const headers = { authorization: `Bearer ${issued.apiKey}` };
    const first = await fetch(`${baseUrl}/v1/account`, { headers });
    assert.equal(first.status, 200);
    const limited = await fetch(`${baseUrl}/v1/account`, { headers });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await limited.json()).error.code, "rate_limit_exceeded");
  });
});
