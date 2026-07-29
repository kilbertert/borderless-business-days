import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
  let issueOptions;
  let output = "";
  let closed = false;
  const store = {
    issueKey(options) {
      issueOptions = options;
      return issued;
    },
    close() {
      closed = true;
    },
  };

  try {
    runAdmin([
      "issue",
      "--customer", "Test Company",
      "--reference", "invoice-42",
      "--days", "7",
      "--limit", "25",
      "--notes", "priority",
      "--key-file", keyFile,
    ], {}, {
      createStore: () => store,
      writeOutput(value) {
        output += value;
      },
    });
    assert.equal(readFileSync(keyFile, "utf8"), `${issued.apiKey}\n`);
    assert.deepEqual(issueOptions, {
      customerName: "Test Company",
      customerRef: "invoice-42",
      days: 7,
      requestLimit: 25,
      notes: "priority",
    });
    if (process.platform !== "win32") assert.equal(statSync(keyFile).mode & 0o777, 0o600);
    assert.doesNotMatch(output, new RegExp(issued.apiKey));
    assert.equal(closed, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("revokes a newly issued key when plaintext output fails", () => {
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

  assert.throws(
    () => runAdmin(["issue", "--customer", "Test Company"], {}, {
      createStore: () => store,
      writeOutput() {
        throw new Error("broken pipe");
      },
    }),
    /standard output: broken pipe.*new API key was revoked/i,
  );
  assert.deepEqual(statusChanges, [{ id: issuedRecord().record.id, status: "revoked" }]);
  assert.equal(closed, true);
});

test("preserves delivery, rollback, and close failures", () => {
  const store = {
    issueKey: issuedRecord,
    setStatus() {
      throw new Error("database unavailable");
    },
    close() {
      throw new Error("close unavailable");
    },
  };

  assert.throws(
    () => runAdmin(["issue", "--customer", "Test Company"], {}, {
      createStore: () => store,
      writeOutput() {
        throw new Error("broken pipe");
      },
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(error.cause.message, /Manual intervention is required for API key/);
      assert.match(error.cause.message, /broken pipe/);
      assert.match(error.cause.message, /automatic revocation failed: database unavailable/);
      assert.match(error.errors[1].message, /close unavailable/);
      return true;
    },
  );
});

test("does not overwrite existing key files or follow symbolic links", { skip: process.platform === "win32" }, () => {
  for (const type of ["file", "symlink"]) {
    const directory = mkdtempSync(path.join(tmpdir(), `bbd-admin-${type}-`));
    const keyFile = path.join(directory, "api.key");
    const targetFile = type === "symlink" ? path.join(directory, "target.key") : keyFile;
    let issued = false;
    let closed = false;
    const store = {
      issueKey() {
        issued = true;
        return issuedRecord();
      },
      close() {
        closed = true;
      },
    };

    try {
      writeFileSync(targetFile, "preserve-me\n", { mode: 0o600 });
      if (type === "symlink") symlinkSync(targetFile, keyFile);
      assert.throws(
        () => runAdmin(["issue", "--customer", "Test Company", "--key-file", keyFile], {}, { createStore: () => store }),
        /Key file already exists/,
      );
      assert.equal(issued, false);
      assert.equal(closed, true);
      assert.equal(readFileSync(targetFile, "utf8"), "preserve-me\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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

test("accepts extension day boundaries as numbers", () => {
  for (const days of [1, 366]) {
    const calls = [];
    let closed = false;
    const store = {
      extend(id, value) {
        calls.push({ id, days: value });
        return { id, days: value };
      },
      close() {
        closed = true;
      },
    };
    runAdmin(["extend", "--id", issuedRecord().record.id, "--days", String(days)], {}, {
      createStore: () => store,
      writeOutput() {},
    });
    assert.deepEqual(calls, [{ id: issuedRecord().record.id, days }]);
    assert.equal(closed, true);
  }
});

test("rejects unknown and duplicate command options", () => {
  assert.throws(() => runAdmin(["issue", "--customer", "Test", "--limt", "10"], {}), /Unknown option/);
  assert.throws(() => runAdmin(["show", "--id", "one", "--id", "two"], {}), /Duplicate option/);
});
