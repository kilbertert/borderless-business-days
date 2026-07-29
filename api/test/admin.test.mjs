import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runAdmin } from "../admin.mjs";

function unwritableKeyPath(directory) {
  const parentFile = path.join(directory, "not-a-directory");
  writeFileSync(parentFile, "blocked", "utf8");
  return path.join(parentFile, "api.key");
}

function issuedRecord() {
  return {
    apiKey: "bbd_live_abc123def456_abcdefghijklmnopqrstuvwxyzABCDEF",
    record: { id: "abc123def456" },
  };
}

test("revokes a newly issued key when its key file cannot be written", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-admin-"));
  const statusChanges = [];
  let closed = false;
  const store = {
    issueKey: issuedRecord,
    setStatus(id, status) {
      statusChanges.push({ id, status });
    },
    close() {
      closed = true;
    },
  };

  try {
    assert.throws(
      () => runAdmin(["issue", "--customer", "Test Company", "--key-file", unwritableKeyPath(directory)], {}, { createStore: () => store }),
      /the new API key was revoked/,
    );
    assert.deepEqual(statusChanges, [{ id: "abc123def456", status: "revoked" }]);
    assert.equal(closed, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reports the key id when file writing and automatic revocation both fail", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-admin-"));
  let closed = false;
  const store = {
    issueKey: issuedRecord,
    setStatus() {
      throw new Error("database unavailable");
    },
    close() {
      closed = true;
    },
  };

  try {
    assert.throws(
      () => runAdmin(["issue", "--customer", "Test Company", "--key-file", unwritableKeyPath(directory)], {}, { createStore: () => store }),
      (error) => {
        assert.match(error.message, /Manual intervention is required for API key abc123def456/);
        assert.match(error.message, /Rollback error: database unavailable/);
        return true;
      },
    );
    assert.equal(closed, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("requires --days for the extend command", () => {
  let closed = false;
  let extended = false;
  const store = {
    extend() {
      extended = true;
    },
    close() {
      closed = true;
    },
  };

  assert.throws(() => runAdmin(["extend", "--id", "abc123def456"], {}, { createStore: () => store }), /--days is required/);
  assert.equal(extended, false);
  assert.equal(closed, true);
});
