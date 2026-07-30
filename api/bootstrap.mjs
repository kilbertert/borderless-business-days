#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./config.mjs";

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

function currentUserOwns(metadata) {
  return typeof process.getuid !== "function" || metadata.uid === process.getuid();
}

function ensurePrivateDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  const metadata = lstatSync(directoryPath);
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || !currentUserOwns(metadata)) {
    throw new Error(`Runtime directory must be a real directory owned by the current user: ${directoryPath}`);
  }
  chmodSync(directoryPath, 0o700);
}

function environmentPath(value, name) {
  if (typeof value !== "string" || value.trim() !== value || /[\r\n]/.test(value) || !path.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path without CR, LF, or leading/trailing whitespace.`);
  }
  return value;
}

function secureEnvironmentFile(filePath) {
  const pathMetadata = lstatSync(filePath);
  if (pathMetadata.isSymbolicLink() || !pathMetadata.isFile() || !currentUserOwns(pathMetadata)) {
    throw new Error(`Runtime environment file must be a regular file owned by the current user: ${filePath}`);
  }

  const descriptor = openSync(filePath, constants.O_RDONLY | NO_FOLLOW);
  try {
    const descriptorMetadata = fstatSync(descriptor);
    if (!descriptorMetadata.isFile()
      || !currentUserOwns(descriptorMetadata)
      || descriptorMetadata.dev !== pathMetadata.dev
      || descriptorMetadata.ino !== pathMetadata.ino) {
      throw new Error(`Runtime environment file changed during validation: ${filePath}`);
    }
    fchmodSync(descriptor, 0o600);
  } finally {
    closeSync(descriptor);
  }
}

export function bootstrapRuntime({ homeDirectory = homedir() } = {}) {
  environmentPath(homeDirectory, "Home directory");
  const configurationDirectory = path.join(homeDirectory, ".config", "borderless-business-days-api");
  const dataDirectory = path.join(homeDirectory, ".local", "share", "borderless-business-days-api");
  const environmentFile = path.join(configurationDirectory, "config.env");
  const databasePath = environmentPath(path.join(dataDirectory, "api.sqlite3"), "Database path");
  const datasetPath = environmentPath(path.join(projectRoot, "src", "data", "holidays.json"), "Dataset path");

  ensurePrivateDirectory(configurationDirectory);
  ensurePrivateDirectory(dataDirectory);

  let created = false;
  const contents = [
    "BBD_API_HOST=127.0.0.1",
    "BBD_API_PORT=4181",
    "BBD_API_PUBLIC_BASE_URL=https://api.borderlessbusinessdays.com",
    "BBD_API_TRUSTED_PROXY_ADDRESSES=127.0.0.1,::1",
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
  let primaryError;
  try {
    writeFileSync(temporaryFile, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
    temporaryCreated = true;
    try {
      linkSync(temporaryFile, environmentFile);
      created = true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (temporaryCreated) {
      try {
        unlinkSync(temporaryFile);
      } catch (cleanupError) {
        if (cleanupError?.code !== "ENOENT") {
          if (primaryError) {
            throw new AggregateError([primaryError, cleanupError], "Runtime bootstrap failed and its temporary file could not be removed.", { cause: primaryError });
          }
          throw cleanupError;
        }
      }
    }
  }

  ensurePrivateDirectory(configurationDirectory);
  ensurePrivateDirectory(dataDirectory);
  secureEnvironmentFile(environmentFile);
  return { created, environmentFile, databasePath, configurationDirectory, dataDirectory };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  process.umask(0o077);
  const result = bootstrapRuntime();
  process.stdout.write(`${JSON.stringify({ status: result.created ? "created" : "existing", environmentFile: result.environmentFile, databasePath: result.databasePath }, null, 2)}\n`);
}
