import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
    apiKey: "bbd_live_abc123def456abc123def456abc123de_abcdefghijklmnopqrstuvwxyzABCDEF",
    record: { id: "abc123def456abc123def456abc123de" },
  };
}

test("shows help without loading runtime configuration", () => {
  let output = "";
  runAdmin(["--help"], undefined, {
    createStore() {
      throw new Error("store must not be created");
    },
    writeOutput(value) {
      output += value;
    },
  });
  assert.match(output, /API key administration/);
});

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
      /new API key was revoked/,
    );
    assert.deepEqual(statusChanges, [{ id: "abc123def456abc123def456abc123de", status: "revoked" }]);
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
        assert.match(error.message, /Manual intervention is required for API key abc123def456abc123def456abc123de/);
        assert.match(error.message, /automatic revocation failed: database unavailable/);
        return true;
      },
    );
    assert.equal(closed, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("writes an issued key only to a private key file", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-admin-"));
  const keyFile = path.join(directory, "api.key");
  const issued = issuedRecord();
  let output = "";
  let closed = false;
  const store = {
    issueKey() {
      return issued;
    },
    close() {
      closed = true;
    },
  };

  try {
    runAdmin(["issue", "--customer", "Test Company", "--key-file", keyFile], {}, {
      createStore: () => store,
      writeOutput(value) {
        output += value;
      },
    });
    assert.equal(readFileSync(keyFile, "utf8"), `${issued.apiKey}\n`);
    if (process.platform !== "win32") assert.equal(statSync(keyFile).mode & 0o777, 0o600);
    assert.doesNotMatch(output, new RegExp(issued.apiKey));
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

  assert.throws(() => runAdmin(["extend", "--id", "abc123def456abc123def456abc123de"], {}, { createStore: () => store }), /--days is required/);
  assert.equal(extended, false);
  assert.equal(closed, true);
});

test("rejects invalid extension days before updating storage", () => {
  for (const days of ["0", "-1", "367", "1.5", "not-a-number"]) {
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

    assert.throws(
      () => runAdmin(["extend", "--id", "abc123def456abc123def456abc123de", "--days", days], {}, { createStore: () => store }),
      /integer|between 1 and 366/,
    );
    assert.equal(extended, false);
    assert.equal(closed, true);
  }
});

test("rejects unknown and duplicate command options", () => {
  assert.throws(() => runAdmin(["issue", "--customer", "Test", "--limt", "10"], {}), /Unknown option/);
  assert.throws(() => runAdmin(["show", "--id", "one", "--id", "two"], {}), /Duplicate option/);
});
