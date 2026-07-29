import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { KeyAccessError, KeyStore } from "../storage.mjs";

test("issues, meters, suspends, extends, and revokes API keys", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-key-store-"));
  const store = new KeyStore({ databasePath: path.join(directory, "api.sqlite3"), keyPepper: "test-pepper-that-is-longer-than-thirty-two-characters" });
  try {
    const issued = store.issueKey({ customerName: "Test Company", customerRef: "test-1", days: 7, requestLimit: 2 });
    assert.match(issued.apiKey, /^bbd_live_[a-f0-9]{12}_[A-Za-z0-9_-]{32,}$/);
    assert.equal(issued.record.request_count, 0);
    assert.equal(store.verify(issued.apiKey).customer_name, "Test Company");

    assert.equal(store.consume(issued.apiKey, "/v1/test").request_count, 1);
    assert.equal(store.consume(issued.apiKey, "/v1/test").request_count, 2);
    assert.throws(() => store.consume(issued.apiKey, "/v1/test"), (error) => error instanceof KeyAccessError && error.code === "quota_exhausted");
    assert.equal(store.usage(issued.record.id).daily[0].request_count, 2);

    store.setStatus(issued.record.id, "suspended");
    assert.throws(() => store.verify(issued.apiKey), (error) => error.code === "suspended_api_key");
    store.setStatus(issued.record.id, "active");
    const previousExpiry = issued.record.expires_at;
    assert.equal(store.extend(issued.record.id, 5).expires_at > previousExpiry, true);

    store.setStatus(issued.record.id, "revoked");
    assert.throws(() => store.verify(issued.apiKey), (error) => error.code === "revoked_api_key");
    assert.throws(() => store.setStatus(issued.record.id, "active"), /cannot be reactivated/);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
