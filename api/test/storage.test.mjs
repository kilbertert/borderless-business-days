import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { KeyAccessError, KeyStore } from "../storage.mjs";

test("issues, meters, suspends, extends, and revokes API keys", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-key-store-"));
  const databasePath = path.join(directory, "api.sqlite3");
  const store = new KeyStore({ databasePath, keyPepper: "test-pepper-that-is-longer-than-thirty-two-characters" });
  try {
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(databasePath).mode & 0o777, 0o600);
    const issued = store.issueKey({ customerName: "Test Company", customerRef: "test-1", days: 7, requestLimit: 2 });
    assert.match(issued.apiKey, /^bbd_live_[a-f0-9]{12}_[A-Za-z0-9_-]{32,}$/);
    assert.equal(issued.record.request_count, 0);
    assert.equal(store.verify(issued.apiKey).customer_name, "Test Company");
    const tamperedKey = `${issued.apiKey.slice(0, -1)}${issued.apiKey.endsWith("X") ? "Y" : "X"}`;
    assert.throws(() => store.verify(tamperedKey), (error) => error instanceof KeyAccessError && error.code === "invalid_api_key");

    assert.equal(store.consume(issued.apiKey, "/v1/test").request_count, 1);
    assert.equal(store.consume(issued.apiKey, "/v1/test").request_count, 2);
    assert.throws(() => store.consume(issued.apiKey, "/v1/test"), (error) => error instanceof KeyAccessError && error.code === "quota_exhausted");
    assert.equal(store.usage(issued.record.id).daily[0].request_count, 2);

    store.setStatus(issued.record.id, "suspended");
    assert.throws(() => store.verify(issued.apiKey), (error) => error.code === "suspended_api_key");
    store.setStatus(issued.record.id, "active");
    const previousExpiry = issued.record.expires_at;
    assert.equal(store.extend(issued.record.id, 5).expires_at > previousExpiry, true);

    const revoked = store.setStatus(issued.record.id, "revoked");
    const revokedAuditCount = store.usage(issued.record.id).audit.filter((entry) => entry.event_type === "key_revoked").length;
    const revokedAgain = store.setStatus(issued.record.id, "revoked");
    assert.equal(revokedAgain.revoked_at, revoked.revoked_at);
    assert.equal(store.usage(issued.record.id).audit.filter((entry) => entry.event_type === "key_revoked").length, revokedAuditCount);
    assert.throws(() => store.verify(issued.apiKey), (error) => error.code === "revoked_api_key");
    assert.throws(() => store.setStatus(issued.record.id, "active"), /cannot be reactivated/);

    const expired = store.issueKey({ customerName: "Expired Company", days: 1, requestLimit: 1 });
    store.database.prepare("UPDATE api_keys SET expires_at = ? WHERE id = ?").run("2000-01-01T00:00:00.000Z", expired.record.id);
    assert.throws(() => store.verify(expired.apiKey), (error) => error instanceof KeyAccessError && error.code === "expired_api_key");
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rolls back key changes when audit insertion fails", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-key-store-"));
  const store = new KeyStore({ databasePath: path.join(directory, "api.sqlite3"), keyPepper: "test-pepper-that-is-longer-than-thirty-two-characters" });
  try {
    const issued = store.issueKey({ customerName: "Atomic Company", days: 7, requestLimit: 10 });
    store.database.exec(`
      CREATE TRIGGER reject_audit BEFORE INSERT ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit unavailable');
      END;
    `);

    assert.throws(() => store.setStatus(issued.record.id, "suspended"), /audit unavailable/);
    assert.equal(store.getKey(issued.record.id).status, "active");
    const keyCount = store.listKeys().length;
    assert.throws(() => store.issueKey({ customerName: "Rejected Company", days: 7, requestLimit: 10 }), /audit unavailable/);
    assert.equal(store.listKeys().length, keyCount);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects a database directory exposed to group or other users", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-key-store-"));
  try {
    chmodSync(directory, 0o755);
    assert.throws(
      () => new KeyStore({ databasePath: path.join(directory, "api.sqlite3"), keyPepper: "test-pepper-that-is-longer-than-thirty-two-characters" }),
      /must not be accessible by group or other users/,
    );
  } finally {
    chmodSync(directory, 0o700);
    rmSync(directory, { recursive: true, force: true });
  }
});
