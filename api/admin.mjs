#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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

function parseArguments(values) {
  const [command, ...rest] = values;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected argument: ${item}`);
    const name = item.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function required(options, name) {
  if (!options[name]) throw new Error(`--${name} is required.`);
  return options[name];
}

function integerOption(options, name, fallback) {
  if (options[name] === undefined) return fallback;
  const value = Number(options[name]);
  if (!Number.isInteger(value)) throw new Error(`--${name} must be an integer.`);
  return value;
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

  const resolvedConfig = config ?? loadConfig();
  const store = createStore_(resolvedConfig);
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
          days: integerOption(options, "days", 30),
          requestLimit: integerOption(options, "limit", 1_000),
          notes: options.notes,
        });
        if (keyFile) {
          try {
            mkdirSync(path.dirname(keyFile), { recursive: true, mode: 0o700 });
            writeFileSync(keyFile, `${issued.apiKey}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
            chmodSync(keyFile, 0o600);
          } catch (error) {
            const fileError = error instanceof Error ? error.message : String(error);
            try {
              store.setStatus(issued.record.id, "revoked");
            } catch (rollbackError) {
              const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
              throw new Error(
                `The key file could not be written, and automatic revocation failed. Manual intervention is required for API key ${issued.record.id}. File error: ${fileError}. Rollback error: ${rollbackMessage}`,
              );
            }
            throw new Error(`The key file could not be written, so the new API key was revoked: ${fileError}`);
          }
          print({ warning: "The plaintext API key was written once to the private key file.", keyFile, key: issued.record }, writeOutput);
        } else {
          print({ warning: "This is the only time the plaintext API key will be displayed.", apiKey: issued.apiKey, key: issued.record }, writeOutput);
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
        print({ key: store.extend(required(options, "id"), integerOption(options, "days")) }, writeOutput);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    store.close();
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
