#!/usr/bin/env node
import { constants, closeSync, existsSync, fchmodSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";
import { KeyStore } from "./storage.mjs";

function usage() {
  return `Borderless Business Days API key administration

Usage:
  node api/admin.mjs init
  node api/admin.mjs issue --customer NAME [--reference REF] [--days 30] [--limit 1000] [--notes TEXT] [--key-file PATH]
  node api/admin.mjs list
  node api/admin.mjs show --id KEY_ID
  node api/admin.mjs suspend --id KEY_ID
  node api/admin.mjs resume --id KEY_ID
  node api/admin.mjs revoke --id KEY_ID
  node api/admin.mjs extend --id KEY_ID --days DAYS

The plaintext API key is displayed only by the issue command. Store and send it through a private channel.`;
}

const COMMAND_OPTIONS = new Map([
  ["init", new Set()],
  ["issue", new Set(["customer", "reference", "days", "limit", "notes", "key-file"])],
  ["list", new Set()],
  ["show", new Set(["id"])],
  ["suspend", new Set(["id"])],
  ["resume", new Set(["id"])],
  ["revoke", new Set(["id"])],
  ["extend", new Set(["id", "days"])],
]);

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

function parseArguments(values) {
  const [command, ...rest] = values;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const name = item.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    if (Object.hasOwn(options, name)) throw new Error(`Duplicate option: --${name}`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function validateOptions(command, options) {
  const allowed = COMMAND_OPTIONS.get(command);
  if (!allowed) throw new Error(`Unknown command: ${command}`);
  for (const name of Object.keys(options)) {
    if (!allowed.has(name)) throw new Error(`Unknown option for ${command}: --${name}`);
  }
}

function required(options, name) {
  if (!options[name]) throw new Error(`--${name} is required.`);
  return options[name];
}

function integerOption(options, name, fallback, { minimum, maximum } = {}) {
  if (options[name] === undefined) return fallback;
  const value = Number(options[name]);
  if (!Number.isInteger(value)) throw new Error(`--${name} must be an integer.`);
  if ((minimum !== undefined && value < minimum) || (maximum !== undefined && value > maximum)) {
    throw new Error(`--${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function failedDeliveryError(store, issued, description, deliveryError, additionalFailures = []) {
  const failures = [...additionalFailures];
  try {
    store.setStatus(issued.record.id, "revoked");
  } catch (rollbackError) {
    failures.push(`automatic revocation failed: ${errorMessage(rollbackError)}`);
  }
  const outcome = failures.length === 0
    ? "The new API key was revoked."
    : `Manual intervention is required for API key ${issued.record.id}: ${failures.join("; ")}.`;
  return new Error(`${description}: ${errorMessage(deliveryError)}. ${outcome}`);
}

function writePrivateKeyFile(keyFile, apiKey) {
  let descriptor;
  let created = false;
  try {
    mkdirSync(path.dirname(keyFile), { recursive: true, mode: 0o700 });
    descriptor = openSync(keyFile, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | NO_FOLLOW, 0o600);
    created = true;
    writeFileSync(descriptor, `${apiKey}\n`, { encoding: "utf8" });
    fchmodSync(descriptor, 0o600);
    closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    const cleanupErrors = [];
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch (closeError) {
        cleanupErrors.push(`close failed: ${errorMessage(closeError)}`);
      }
    }
    if (created) {
      try {
        unlinkSync(keyFile);
      } catch (cleanupError) {
        if (cleanupError?.code !== "ENOENT") cleanupErrors.push(`file cleanup failed: ${errorMessage(cleanupError)}`);
      }
    }
    return { error, cleanupErrors };
  }
  return undefined;
}

function writeToStdout(value) {
  process.stdout.write(value);
}

function print(value, writeOutput) {
  writeOutput(`${JSON.stringify(value, null, 2)}\n`);
}

function createStore(config) {
  return new KeyStore(config);
}

export function runAdmin(arguments_, config, { createStore: createStore_ = createStore, writeOutput = writeToStdout } = {}) {
  const { command, options } = parseArguments(arguments_);
  if (!command || command === "help" || command === "--help") {
    writeOutput(`${usage()}\n`);
    return;
  }
  validateOptions(command, options);

  const resolvedConfig = config ?? loadConfig();
  const store = createStore_(resolvedConfig);
  let operationError;
  try {
    switch (command) {
      case "init":
        print({ status: "initialized", databasePath: resolvedConfig.databasePath }, writeOutput);
        break;
      case "issue": {
        const keyFile = options["key-file"] ? path.resolve(options["key-file"]) : undefined;
        if (keyFile && existsSync(keyFile)) throw new Error(`Key file already exists: ${keyFile}`);
        const issued = store.issueKey({
          customerName: required(options, "customer"),
          customerRef: options.reference,
          days: integerOption(options, "days", 30, { minimum: 1, maximum: 366 }),
          requestLimit: integerOption(options, "limit", 1_000, { minimum: 1, maximum: 10_000_000 }),
          notes: options.notes,
        });
        if (keyFile) {
          const fileFailure = writePrivateKeyFile(keyFile, issued.apiKey);
          if (fileFailure) {
            throw failedDeliveryError(store, issued, "The key file could not be written", fileFailure.error, fileFailure.cleanupErrors);
          }
          print({ warning: "The plaintext API key was written once to the private key file.", keyFile, key: issued.record }, writeOutput);
        } else {
          try {
            print({ warning: "This is the only time the plaintext API key will be displayed.", apiKey: issued.apiKey, key: issued.record }, writeOutput);
          } catch (outputError) {
            throw failedDeliveryError(store, issued, "The plaintext API key could not be written to standard output", outputError);
          }
        }
        break;
      }
      case "list":
        print({ keys: store.listKeys() }, writeOutput);
        break;
      case "show":
        print(store.usage(required(options, "id")), writeOutput);
        break;
      case "suspend":
        print({ key: store.setStatus(required(options, "id"), "suspended") }, writeOutput);
        break;
      case "resume":
        print({ key: store.setStatus(required(options, "id"), "active") }, writeOutput);
        break;
      case "revoke":
        print({ key: store.setStatus(required(options, "id"), "revoked") }, writeOutput);
        break;
      case "extend":
        if (options.days === undefined) throw new Error("--days is required.");
        print({ key: store.extend(required(options, "id"), integerOption(options, "days", undefined, { minimum: 1, maximum: 366 })) }, writeOutput);
        break;
    }
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      store.close();
    } catch (closeError) {
      if (operationError) {
        throw new AggregateError([operationError, closeError], "The administration command failed and the API key store could not be closed.", { cause: operationError });
      }
      throw closeError;
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  process.umask(0o077);
  try {
    runAdmin(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
    process.exitCode = 1;
  }
}
