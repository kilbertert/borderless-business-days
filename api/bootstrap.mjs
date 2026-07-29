#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { chmodSync, linkSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./config.mjs";

export function bootstrapRuntime({ homeDirectory = homedir() } = {}) {
  process.umask(0o077);
  const configurationDirectory = path.join(homeDirectory, ".config", "borderless-business-days-api");
  const dataDirectory = path.join(homeDirectory, ".local", "share", "borderless-business-days-api");
  const environmentFile = path.join(configurationDirectory, "config.env");
  const databasePath = path.join(dataDirectory, "api.sqlite3");
  const datasetPath = path.join(projectRoot, "src", "data", "holidays.json");

  mkdirSync(configurationDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });

  let created = false;
  const contents = [
    "BBD_API_HOST=127.0.0.1",
    "BBD_API_PORT=4181",
    `BBD_API_DB=${databasePath}`,
    `BBD_API_DATASET=${datasetPath}`,
    `BBD_API_KEY_PEPPER=${randomBytes(48).toString("base64url")}`,
    "BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE=120",
    "BBD_API_RATE_LIMIT_PER_MINUTE=60",
    "BBD_API_MAX_BODY_BYTES=32768",
    "",
  ].join("\n");
  const temporaryFile = `${environmentFile}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporaryFile, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
    temporaryCreated = true;
    try {
      linkSync(temporaryFile, environmentFile);
      created = true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  } finally {
    if (temporaryCreated) {
      try {
        unlinkSync(temporaryFile);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  chmodSync(configurationDirectory, 0o700);
  chmodSync(dataDirectory, 0o700);
  chmodSync(environmentFile, 0o600);
  return { created, environmentFile, databasePath, configurationDirectory, dataDirectory };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const result = bootstrapRuntime();
  process.stdout.write(`${JSON.stringify({ status: result.created ? "created" : "existing", environmentFile: result.environmentFile, databasePath: result.databasePath }, null, 2)}\n`);
}
