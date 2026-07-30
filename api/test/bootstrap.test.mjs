import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { bootstrapRuntime } from "../bootstrap.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const bootstrapScript = path.resolve(testDirectory, "../bootstrap.mjs");

async function runBootstrapCli(homeDirectory) {
  const child = spawn(process.execPath, [bootstrapScript], {
    env: {
      ...process.env,
      HOME: homeDirectory,
      USERPROFILE: homeDirectory,
      HOMEDRIVE: "",
      HOMEPATH: homeDirectory,
    },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
    killSignal: "SIGKILL",
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code, signal] = await once(child, "close");
  return { code, signal, stdout, stderr };
}

test("creates private runtime configuration once and preserves the existing secret", () => {
  const homeDirectory = mkdtempSync(path.join(tmpdir(), "bbd-bootstrap-"));
  const previousUmask = process.umask();

  try {
    const first = bootstrapRuntime({ homeDirectory });
    const firstContents = readFileSync(first.environmentFile, "utf8");
    assert.equal(first.created, true);
    assert.match(firstContents, /BBD_API_KEY_PEPPER=[A-Za-z0-9_-]{32,}/);
    assert.match(firstContents, /^BBD_API_PUBLIC_BASE_URL=https:\/\/api\.borderlessbusinessdays\.com$/m);
    assert.match(firstContents, /^BBD_API_TRUSTED_PROXY_ADDRESSES=127\.0\.0\.1,::1$/m);
    assert.equal(process.umask(), previousUmask);
    if (process.platform !== "win32") {
      assert.equal(statSync(first.configurationDirectory).mode & 0o777, 0o700);
      assert.equal(statSync(first.dataDirectory).mode & 0o777, 0o700);
      assert.equal(statSync(first.environmentFile).mode & 0o777, 0o600);
    }

    const second = bootstrapRuntime({ homeDirectory });
    assert.equal(second.created, false);
    assert.equal(readFileSync(second.environmentFile, "utf8"), firstContents);
  } finally {
    rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test("allows concurrent CLI bootstrap without replacing the winning secret", async () => {
  const homeDirectory = mkdtempSync(path.join(tmpdir(), "bbd-bootstrap-cli-"));
  try {
    const results = await Promise.all([runBootstrapCli(homeDirectory), runBootstrapCli(homeDirectory)]);
    assert.deepEqual(results.map((result) => result.code), [0, 0]);
    assert.deepEqual(results.map((result) => result.signal), [null, null]);
    assert.deepEqual(results.map((result) => JSON.parse(result.stdout).status).sort(), ["created", "existing"]);
    assert.deepEqual(results.map((result) => result.stderr), ["", ""]);
    const environmentFile = path.join(homeDirectory, ".config", "borderless-business-days-api", "config.env");
    assert.match(readFileSync(environmentFile, "utf8"), /BBD_API_KEY_PEPPER=[A-Za-z0-9_-]{32,}/);
    if (process.platform !== "win32") assert.equal(statSync(environmentFile).mode & 0o777, 0o600);
  } finally {
    rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test("tightens existing runtime directory and environment file permissions", { skip: process.platform === "win32" }, () => {
  const homeDirectory = mkdtempSync(path.join(tmpdir(), "bbd-bootstrap-existing-"));
  const configurationDirectory = path.join(homeDirectory, ".config", "borderless-business-days-api");
  const dataDirectory = path.join(homeDirectory, ".local", "share", "borderless-business-days-api");
  const environmentFile = path.join(configurationDirectory, "config.env");
  try {
    mkdirSync(configurationDirectory, { recursive: true, mode: 0o755 });
    mkdirSync(dataDirectory, { recursive: true, mode: 0o755 });
    chmodSync(configurationDirectory, 0o755);
    chmodSync(dataDirectory, 0o755);
    writeFileSync(environmentFile, "preserved=true\n", { mode: 0o644 });
    chmodSync(environmentFile, 0o644);

    const result = bootstrapRuntime({ homeDirectory });
    assert.equal(result.created, false);
    assert.equal(readFileSync(environmentFile, "utf8"), "preserved=true\n");
    assert.equal(statSync(configurationDirectory).mode & 0o777, 0o700);
    assert.equal(statSync(dataDirectory).mode & 0o777, 0o700);
    assert.equal(statSync(environmentFile).mode & 0o777, 0o600);
  } finally {
    rmSync(homeDirectory, { recursive: true, force: true });
  }
});

test("rejects unsafe existing environment file types", { skip: process.platform === "win32" }, () => {
  for (const type of ["symlink", "directory", "fifo"]) {
    const homeDirectory = mkdtempSync(path.join(tmpdir(), `bbd-bootstrap-${type}-`));
    const configurationDirectory = path.join(homeDirectory, ".config", "borderless-business-days-api");
    const environmentFile = path.join(configurationDirectory, "config.env");
    try {
      mkdirSync(configurationDirectory, { recursive: true, mode: 0o700 });
      if (type === "symlink") {
        const target = path.join(homeDirectory, "target.env");
        writeFileSync(target, "target=true\n", { mode: 0o600 });
        symlinkSync(target, environmentFile);
      } else if (type === "directory") {
        mkdirSync(environmentFile, { mode: 0o700 });
      } else {
        const result = spawnSync("mkfifo", [environmentFile], { encoding: "utf8" });
        if (result.error?.code === "ENOENT") continue;
        assert.equal(result.status, 0, result.stderr);
      }
      assert.throws(() => bootstrapRuntime({ homeDirectory }), /regular file owned by the current user/);
    } finally {
      rmSync(homeDirectory, { recursive: true, force: true });
    }
  }
});

test("rejects home paths that cannot be represented safely in the environment file", () => {
  const base = mkdtempSync(path.join(tmpdir(), "bbd-bootstrap-path-"));
  try {
    assert.throws(() => bootstrapRuntime({ homeDirectory: `${base} ` }), /without CR, LF/);
    assert.throws(() => bootstrapRuntime({ homeDirectory: `${base}\nchild` }), /without CR, LF/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
