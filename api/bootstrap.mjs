#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { projectRoot } from "./config.mjs";

export function bootstrapRuntime() {
  process.umask(0o077);
  const configurationDirectory = path.join(homedir(), ".config", "borderless-business-days-api");
  const dataDirectory = path.join(homedir(), ".local", "share", "borderless-business-days-api");
  const environmentFile = path.join(configurationDirectory, "config.env");
  const databasePath = path.join(dataDirectory, "api.sqlite3");
  const datasetPath = path.join(projectRoot, "src", "data", "holidays.json");

  mkdirSync(configurationDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });

  let created = false;
  if (!existsSync(environmentFile)) {
    const contents = [
      "BBD_API_HOST=127.0.0.1",
      "BBD_API_PORT=4181",
      `BBD_API_DB=${databasePath}`,
      `BBD_API_DATASET=${datasetPath}`,
      `BBD_API_KEY_PEPPER=${randomBytes(48).toString("base64url")}`,
      "BBD_API_RATE_LIMIT_PER_MINUTE=60",
      "BBD_API_MAX_BODY_BYTES=32768",
      "",
    ].join("\n");
    writeFileSync(environmentFile, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
    created = true;
  }

  chmodSync(configurationDirectory, 0o700);
  chmodSync(dataDirectory, 0o700);
  chmodSync(environmentFile, 0o600);
  return { created, environmentFile, databasePath, configurationDirectory, dataDirectory };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = bootstrapRuntime();
  process.stdout.write(`${JSON.stringify({ status: result.created ? "created" : "existing", environmentFile: result.environmentFile, databasePath: result.databasePath }, null, 2)}\n`);
}
