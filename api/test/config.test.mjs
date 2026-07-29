import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig, readEnvironmentFile } from "../config.mjs";

const isolatedEnvironment = {
  BBD_API_HOST: undefined,
  BBD_API_PORT: undefined,
  BBD_API_DB: undefined,
  BBD_API_DATASET: undefined,
  BBD_API_KEY_PEPPER: undefined,
  BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE: undefined,
  BBD_API_RATE_LIMIT_PER_MINUTE: undefined,
  BBD_API_MAX_BODY_BYTES: undefined,
  BBD_API_TRUSTED_PROXY_ADDRESSES: undefined,
  XDG_DATA_HOME: undefined,
};

test("validates private API configuration values", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-config-"));
  const base = {
    ...isolatedEnvironment,
    environmentFile: path.join(directory, "missing.env"),
    BBD_API_KEY_PEPPER: "x".repeat(32),
  };

  try {
    const config = loadConfig(base);
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.preAuthRateLimitPerMinute, 120);
    assert.throws(() => loadConfig({ ...base, BBD_API_KEY_PEPPER: 123 }), /at least 32 characters/);
    assert.throws(() => loadConfig({ ...base, BBD_API_HOST: " " }), /BBD_API_HOST must be a non-empty string/);
    assert.throws(() => loadConfig({ ...base, BBD_API_DB: "" }), /BBD_API_DB must be a non-empty string/);
    assert.throws(() => loadConfig({ ...base, BBD_API_DATASET: "  " }), /BBD_API_DATASET must be a non-empty string/);
    assert.throws(() => loadConfig({ ...base, XDG_DATA_HOME: "" }), /XDG_DATA_HOME must be a non-empty string/);
    assert.throws(() => loadConfig({ ...base, BBD_API_DB: "relative.sqlite3" }), /BBD_API_DB must be an absolute path/);
    assert.throws(() => loadConfig({ ...base, BBD_API_DATASET: "relative.json" }), /BBD_API_DATASET must be an absolute path/);
    assert.throws(() => loadConfig({ ...base, XDG_DATA_HOME: ".data" }), /XDG_DATA_HOME must be an absolute path/);
    assert.deepEqual(loadConfig({ ...base, BBD_API_TRUSTED_PROXY_ADDRESSES: "127.0.0.1, ::1,127.0.0.1" }).trustedProxyAddresses, ["127.0.0.1", "::1"]);
    assert.throws(() => loadConfig({ ...base, BBD_API_TRUSTED_PROXY_ADDRESSES: "127.0.0.1,not-an-ip" }), /only valid IP addresses/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("enforces configuration integer boundaries", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-config-integers-"));
  const base = {
    ...isolatedEnvironment,
    environmentFile: path.join(directory, "missing.env"),
    BBD_API_KEY_PEPPER: "x".repeat(32),
  };
  const validCases = [
    ["BBD_API_PORT", 1, "port", 1],
    ["BBD_API_PORT", 65_535, "port", 65_535],
    ["BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE", 1, "preAuthRateLimitPerMinute", 1],
    ["BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE", 100_000, "preAuthRateLimitPerMinute", 100_000],
    ["BBD_API_RATE_LIMIT_PER_MINUTE", 1, "rateLimitPerMinute", 1],
    ["BBD_API_RATE_LIMIT_PER_MINUTE", 10_000, "rateLimitPerMinute", 10_000],
    ["BBD_API_MAX_BODY_BYTES", 1_024, "maximumBodyBytes", 1_024],
    ["BBD_API_MAX_BODY_BYTES", 1_048_576, "maximumBodyBytes", 1_048_576],
  ];
  const invalidCases = [
    ["BBD_API_PORT", 0],
    ["BBD_API_PORT", 65_536],
    ["BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE", 0],
    ["BBD_API_PREAUTH_RATE_LIMIT_PER_MINUTE", 100_001],
    ["BBD_API_RATE_LIMIT_PER_MINUTE", 0],
    ["BBD_API_RATE_LIMIT_PER_MINUTE", 10_001],
    ["BBD_API_MAX_BODY_BYTES", 1_023],
    ["BBD_API_MAX_BODY_BYTES", 1_048_577],
    ["BBD_API_MAX_BODY_BYTES", 1.5],
    ["BBD_API_PORT", "not-a-number"],
  ];

  try {
    for (const [name, value, property, expected] of validCases) {
      assert.equal(loadConfig({ ...base, [name]: value })[property], expected);
    }
    for (const [name, value] of invalidCases) {
      assert.throws(() => loadConfig({ ...base, [name]: value }), new RegExp(`${name} must be an integer`));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("requires the environment file to be private and regular", { skip: process.platform === "win32" }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-config-file-"));
  const environmentFile = path.join(directory, "config.env");
  const targetFile = path.join(directory, "target.env");
  const symlinkFile = path.join(directory, "symlink.env");
  const directoryFile = path.join(directory, "directory.env");
  const contents = `BBD_API_KEY_PEPPER=${"x".repeat(32)}\n`;
  try {
    writeFileSync(environmentFile, contents, { mode: 0o600 });
    chmodSync(environmentFile, 0o600);
    assert.equal(readEnvironmentFile(environmentFile).BBD_API_KEY_PEPPER, "x".repeat(32));

    chmodSync(environmentFile, 0o644);
    assert.throws(() => readEnvironmentFile(environmentFile), /permissions must not exceed 0600/);

    writeFileSync(targetFile, contents, { mode: 0o600 });
    symlinkSync(targetFile, symlinkFile);
    assert.throws(() => readEnvironmentFile(symlinkFile), /regular file/);

    mkdirSync(directoryFile);
    assert.throws(() => readEnvironmentFile(directoryFile), /regular file/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
