import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { bootstrapRuntime } from "../bootstrap.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const bootstrapScript = path.resolve(testDirectory, "../bootstrap.mjs");

async function runBootstrapCli(homeDirectory) {
  const child = spawn(process.execPath, [bootstrapScript], {
    env: { ...process.env, HOME: homeDirectory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "close");
  return { code, stdout, stderr };
}

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

test("allows concurrent CLI bootstrap without replacing the winning secret", async () => {
  const homeDirectory = mkdtempSync(path.join(tmpdir(), "bbd-bootstrap-cli-"));
  try {
    const results = await Promise.all([runBootstrapCli(homeDirectory), runBootstrapCli(homeDirectory)]);
    assert.deepEqual(results.map((result) => result.code), [0, 0]);
    assert.deepEqual(results.map((result) => JSON.parse(result.stdout).status).sort(), ["created", "existing"]);
    assert.deepEqual(results.map((result) => result.stderr), ["", ""]);
    const environmentFile = path.join(homeDirectory, ".config", "borderless-business-days-api", "config.env");
    assert.match(readFileSync(environmentFile, "utf8"), /BBD_API_KEY_PEPPER=[A-Za-z0-9_-]{32,}/);
    assert.equal(statSync(environmentFile).mode & 0o777, 0o600);
  } finally {
    rmSync(homeDirectory, { recursive: true, force: true });
  }
});
