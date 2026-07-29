import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "../config.mjs";

test("validates private API configuration values", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-config-"));
  const base = {
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
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
