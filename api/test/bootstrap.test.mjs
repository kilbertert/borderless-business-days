import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { bootstrapRuntime } from "../bootstrap.mjs";

test("creates private runtime configuration once and preserves the existing secret", () => {
  const homeDirectory = mkdtempSync(path.join(tmpdir(), "bbd-bootstrap-"));
  const previousUmask = process.umask();

  try {
    const first = bootstrapRuntime({ homeDirectory });
    const firstContents = readFileSync(first.environmentFile, "utf8");
    assert.equal(first.created, true);
    assert.match(firstContents, /BBD_API_KEY_PEPPER=[A-Za-z0-9_-]{32,}/);
    assert.equal(statSync(first.configurationDirectory).mode & 0o777, 0o700);
    assert.equal(statSync(first.dataDirectory).mode & 0o777, 0o700);
    assert.equal(statSync(first.environmentFile).mode & 0o777, 0o600);

    const second = bootstrapRuntime({ homeDirectory });
    assert.equal(second.created, false);
    assert.equal(readFileSync(second.environmentFile, "utf8"), firstContents);
  } finally {
    process.umask(previousUmask);
    rmSync(homeDirectory, { recursive: true, force: true });
  }
});
