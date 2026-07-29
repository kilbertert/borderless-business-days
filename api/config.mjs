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

export function loadConfig(overrides = {}) {
  const defaultEnvironmentFile = path.join(homedir(), ".config", "borderless-business-days-api", "config.env");
  const environmentFile = overrides.environmentFile ?? process.env.BBD_API_ENV_FILE ?? defaultEnvironmentFile;
  const fileValues = readEnvironmentFile(environmentFile);
  const values = { ...fileValues, ...process.env, ...overrides };
  const dataHome = values.XDG_DATA_HOME ?? path.join(homedir(), ".local", "share");
  const keyPepper = values.BBD_API_KEY_PEPPER;

  if (!keyPepper || keyPepper.length < 32) {
    throw new Error(`BBD_API_KEY_PEPPER must be set to at least 32 characters in ${environmentFile}.`);
  }

  return {
    environmentFile,
    host: values.BBD_API_HOST ?? "127.0.0.1",
    port: parseInteger(values.BBD_API_PORT, 4181, { minimum: 1, maximum: 65_535, name: "BBD_API_PORT" }),
    databasePath: values.BBD_API_DB ?? path.join(dataHome, "borderless-business-days-api", "api.sqlite3"),
    datasetPath: values.BBD_API_DATASET ?? path.join(projectRoot, "src", "data", "holidays.json"),
    keyPepper,
    rateLimitPerMinute: parseInteger(values.BBD_API_RATE_LIMIT_PER_MINUTE, 60, { minimum: 1, maximum: 10_000, name: "BBD_API_RATE_LIMIT_PER_MINUTE" }),
    maximumBodyBytes: parseInteger(values.BBD_API_MAX_BODY_BYTES, 32_768, { minimum: 1_024, maximum: 1_048_576, name: "BBD_API_MAX_BODY_BYTES" }),
  };
}
