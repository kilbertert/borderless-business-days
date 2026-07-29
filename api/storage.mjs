import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class KeyAccessError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = "KeyAccessError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + days * 86_400_000).toISOString();
}

function publicKeyRecord(row) {
  if (!row) return undefined;
  const { key_hash: ignored, ...record } = row;
  void ignored;
  return record;
}

export function extractKeyId(apiKey) {
  const match = /^bbd_live_([a-f0-9]{12})_([A-Za-z0-9_-]{32,})$/.exec(apiKey ?? "");
  return match?.[1];
}

export class KeyStore {
  constructor({ databasePath, keyPepper }) {
    this.databasePath = databasePath;
    this.keyPepper = keyPepper;
    const databaseDirectory = path.dirname(databasePath);
    mkdirSync(databaseDirectory, { recursive: true, mode: 0o700 });
    if ((statSync(databaseDirectory).mode & 0o077) !== 0) {
      throw new Error(`Database directory must not be accessible by group or other users: ${databaseDirectory}`);
    }
    const descriptor = openSync(databasePath, "a", 0o600);
    closeSync(descriptor);
    chmodSync(databasePath, 0o600);

    let database;
    try {
      database = new DatabaseSync(databasePath);
      this.database = database;
      this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
      this.database.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        customer_ref TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked')),
        created_at TEXT NOT NULL,
        activated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        request_limit INTEGER NOT NULL CHECK (request_limit > 0),
        request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
        last_used_at TEXT,
        revoked_at TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS usage_daily (
        key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        usage_date TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (key_id, usage_date, endpoint)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS api_keys_status_expiry ON api_keys(status, expires_at);
      CREATE INDEX IF NOT EXISTS audit_log_key_created ON audit_log(key_id, created_at);
    `);
      this.statements = {
      insertKey: this.database.prepare(`
        INSERT INTO api_keys (
          id, key_hash, customer_name, customer_ref, status, created_at, activated_at,
          expires_at, request_limit, request_count, notes
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0, ?)
      `),
      keyById: this.database.prepare("SELECT * FROM api_keys WHERE id = ?"),
      listKeys: this.database.prepare("SELECT * FROM api_keys ORDER BY created_at DESC"),
      updateUsage: this.database.prepare(`
        UPDATE api_keys
        SET request_count = request_count + 1, last_used_at = ?
        WHERE id = ? AND status = 'active' AND expires_at > ? AND request_count < request_limit
      `),
      upsertDaily: this.database.prepare(`
        INSERT INTO usage_daily (key_id, usage_date, endpoint, request_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(key_id, usage_date, endpoint)
        DO UPDATE SET request_count = request_count + 1
      `),
      usageForKey: this.database.prepare("SELECT usage_date, endpoint, request_count FROM usage_daily WHERE key_id = ? ORDER BY usage_date DESC, endpoint"),
      updateStatus: this.database.prepare("UPDATE api_keys SET status = ?, revoked_at = ? WHERE id = ?"),
      updateExpiry: this.database.prepare("UPDATE api_keys SET expires_at = ? WHERE id = ?"),
      insertAudit: this.database.prepare("INSERT INTO audit_log (key_id, event_type, details_json, created_at) VALUES (?, ?, ?, ?)"),
      auditForKey: this.database.prepare("SELECT event_type, details_json, created_at FROM audit_log WHERE key_id = ? ORDER BY created_at DESC"),
      };
      this.secureDatabaseFiles();
    } catch (error) {
      database?.close();
      throw error;
    }
  }

  secureDatabaseFiles() {
    for (const filePath of [this.databasePath, `${this.databasePath}-wal`, `${this.databasePath}-shm`]) {
      if (existsSync(filePath)) chmodSync(filePath, 0o600);
    }
  }

  hash(apiKey) {
    return createHmac("sha256", this.keyPepper).update(apiKey).digest("hex");
  }

  hashesMatch(apiKey, expectedHex) {
    const actual = Buffer.from(this.hash(apiKey), "hex");
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  transaction(operation) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        // Preserve the business operation error.
      }
      throw error;
    }
  }

  audit(keyId, eventType, details = {}) {
    this.statements.insertAudit.run(keyId ?? null, eventType, JSON.stringify(details), nowIso());
  }

  issueKey({ customerName, customerRef = null, days = 30, requestLimit = 1_000, notes = null }) {
    if (!customerName?.trim()) throw new Error("Customer name is required.");
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Days must be between 1 and 366.");
    if (!Number.isInteger(requestLimit) || requestLimit < 1 || requestLimit > 10_000_000) throw new Error("Request limit must be between 1 and 10,000,000.");

    const id = randomBytes(6).toString("hex");
    const apiKey = `bbd_live_${id}_${randomBytes(32).toString("base64url")}`;
    const createdAt = nowIso();
    const expiresAt = addDays(createdAt, days);
    const record = this.transaction(() => {
      this.statements.insertKey.run(
        id,
        this.hash(apiKey),
        customerName.trim(),
        customerRef?.trim() || null,
        createdAt,
        createdAt,
        expiresAt,
        requestLimit,
        notes?.trim() || null,
      );
      this.audit(id, "key_issued", { customerName: customerName.trim(), customerRef, expiresAt, requestLimit });
      return publicKeyRecord(this.statements.keyById.get(id));
    });
    return { apiKey, record };
  }

  verify(apiKey) {
    const id = extractKeyId(apiKey);
    if (!id) throw new KeyAccessError("The API key is invalid.", "invalid_api_key", 401);
    const row = this.statements.keyById.get(id);
    if (!row || !this.hashesMatch(apiKey, row.key_hash)) {
      throw new KeyAccessError("The API key is invalid.", "invalid_api_key", 401);
    }
    if (row.status === "revoked") throw new KeyAccessError("The API key has been revoked.", "revoked_api_key", 403);
    if (row.status === "suspended") throw new KeyAccessError("The API key is suspended.", "suspended_api_key", 403);
    if (row.expires_at <= nowIso()) throw new KeyAccessError("The API key has expired.", "expired_api_key", 403);
    return publicKeyRecord(row);
  }

  consume(apiKey, endpoint) {
    const verified = this.verify(apiKey);
    const timestamp = nowIso();
    return this.transaction(() => {
      const result = this.statements.updateUsage.run(timestamp, verified.id, timestamp);
      if (result.changes !== 1) {
        const current = this.statements.keyById.get(verified.id);
        if (current?.request_count >= current?.request_limit) {
          throw new KeyAccessError("The API key request allowance is exhausted.", "quota_exhausted", 429);
        }
        throw new KeyAccessError("The API key is not currently usable.", "api_key_unavailable", 403);
      }
      this.statements.upsertDaily.run(verified.id, timestamp.slice(0, 10), endpoint);
      return publicKeyRecord(this.statements.keyById.get(verified.id));
    });
  }

  getKey(id) {
    return publicKeyRecord(this.statements.keyById.get(id));
  }

  listKeys() {
    return this.statements.listKeys.all().map(publicKeyRecord);
  }

  usage(id) {
    const record = this.getKey(id);
    if (!record) throw new Error(`Unknown API key id: ${id}`);
    return {
      record,
      daily: this.statements.usageForKey.all(id),
      audit: this.statements.auditForKey.all(id).map(({ details_json: detailsJson, ...entry }) => ({ ...entry, details: JSON.parse(detailsJson) })),
    };
  }

  setStatus(id, status) {
    if (!["active", "suspended", "revoked"].includes(status)) throw new Error(`Unsupported status: ${status}`);
    return this.transaction(() => {
      const existing = this.getKey(id);
      if (!existing) throw new Error(`Unknown API key id: ${id}`);
      if (existing.status === "revoked" && status !== "revoked") throw new Error("A revoked API key cannot be reactivated.");
      if (existing.status === status) return existing;
      const revokedAt = status === "revoked" ? nowIso() : null;
      this.statements.updateStatus.run(status, revokedAt, id);
      this.audit(id, `key_${status}`, { previousStatus: existing.status });
      return this.getKey(id);
    });
  }

  extend(id, days) {
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Extension days must be between 1 and 366.");
    return this.transaction(() => {
      const existing = this.getKey(id);
      if (!existing) throw new Error(`Unknown API key id: ${id}`);
      if (existing.status === "revoked") throw new Error("A revoked API key cannot be extended.");
      const base = Math.max(Date.now(), new Date(existing.expires_at).getTime());
      const expiresAt = new Date(base + days * 86_400_000).toISOString();
      this.statements.updateExpiry.run(expiresAt, id);
      this.audit(id, "key_extended", { previousExpiry: existing.expires_at, expiresAt, days });
      return this.getKey(id);
    });
  }

  close() {
    this.database.close();
  }
}
