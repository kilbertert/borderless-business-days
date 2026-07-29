import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(apiDirectory, "..");

function unquote(value) {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  return value;
}

export function readEnvironmentFile(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Invalid environment line in ${filePath}`);
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1).trim());
    values[key] = value;
  }
  return values;
}

function parseInteger(value, fallback, { minimum, maximum, name }) {
  const resolved = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return resolved;
}

function parseNonEmptyString(value, fallback, name) {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "string" || !resolved.trim()) throw new Error(`${name} must be a non-empty string.`);
  return resolved.trim();
}

export function loadConfig(overrides = {}) {
  const defaultEnvironmentFile = path.join(homedir(), ".config", "borderless-business-days-api", "config.env");
  const environmentFile = overrides.environmentFile ?? process.env.BBD_API_ENV_FILE ?? defaultEnvironmentFile;
  const fileValues = readEnvironmentFile(environmentFile);
  const values = { ...fileValues, ...process.env, ...overrides };
  const dataHome = parseNonEmptyString(values.XDG_DATA_HOME, path.join(homedir(), ".local", "share"), "XDG_DATA_HOME");
  const keyPepper = values.BBD_API_KEY_PEPPER;

  if (typeof keyPepper !== "string" || keyPepper.length < 32) {
    throw new Error(`BBD_API_KEY_PEPPER must be set to at least 32 characters in ${environmentFile}.`);
  }

  return {
    environmentFile,
    host: parseNonEmptyString(values.BBD_API_HOST, "127.0.0.1", "BBD_API_HOST"),
    port: parseInteger(values.BBD_API_PORT, 4181, { minimum: 1, maximum: 65_535, name: "BBD_API_PORT" }),
    databasePath: parseNonEmptyString(values.BBD_API_DB, path.join(dataHome, "borderless-business-days-api", "api.sqlite3"), "BBD_API_DB"),
    datasetPath: parseNonEmptyString(values.BBD_API_DATASET, path.join(projectRoot, "src", "data", "holidays.json"), "BBD_API_DATASET"),
    keyPepper,
    preAuthRateLimitPerMinute: parseInteger(values.BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE, 120, { minimum: 1, maximum: 100_000, name: "BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE" }),
    rateLimitPerMinute: parseInteger(values.BBD_API_RATE_LIMIT_PER_MINUTE, 60, { minimum: 1, maximum: 10_000, name: "BBD_API_RATE_LIMIT_PER_MINUTE" }),
    maximumBodyBytes: parseInteger(values.BBD_API_MAX_BODY_BYTES, 32_768, { minimum: 1_024, maximum: 1_048_576, name: "BBD_API_MAX_BODY_BYTES" }),
  };
}
