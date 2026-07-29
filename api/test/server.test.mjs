import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadDataset } from "../calendar.mjs";
import { createApiServer } from "../server.mjs";
import { KeyStore } from "../storage.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(testDirectory, "../../src/data/holidays.json");
const silentLogger = { info() {}, error() {} };

test("serves authenticated calculations and enforces quota", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-api-server-"));
  const config = {
    host: "127.0.0.1",
    port: 0,
    databasePath: path.join(directory, "api.sqlite3"),
    datasetPath,
    keyPepper: "test-pepper-that-is-longer-than-thirty-two-characters",
    rateLimitPerMinute: 100,
    maximumBodyBytes: 32_768,
  };
  const dataset = loadDataset(datasetPath);
  const store = new KeyStore(config);
  const issued = store.issueKey({ customerName: "Server Test", days: 1, requestLimit: 2 });
  const server = createApiServer({ config, dataset, store, logger: silentLogger });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${issued.apiKey}`, "content-type": "application/json" };

  try {
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);

    const unauthorized = await fetch(`${baseUrl}/v1/account`);
    assert.equal(unauthorized.status, 401);

    const analyze = await fetch(`${baseUrl}/v1/business-days/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["US", "GB"], start: "2026-01-01", end: "2026-01-05" }),
    });
    assert.equal(analyze.status, 200);
    assert.equal(analyze.headers.get("x-quota-remaining"), "1");
    const analyzeBody = await analyze.json();
    assert.equal(analyzeBody.data.summary.sharedBusinessDays, 2);

    const account = await fetch(`${baseUrl}/v1/account`, { headers: { authorization: `Bearer ${issued.apiKey}` } });
    assert.equal(account.status, 200);
    assert.equal((await account.json()).data.key.requestCount, 1);

    const add = await fetch(`${baseUrl}/v1/business-days/add`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["US"], start: "2026-01-01", amount: 1 }),
    });
    assert.equal(add.status, 200);
    assert.equal(add.headers.get("x-quota-remaining"), "0");

    const exhausted = await fetch(`${baseUrl}/v1/business-days/windows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ countries: ["US", "GB"], start: "2026-01-01", horizonDays: 30, businessDays: 3 }),
    });
    assert.equal(exhausted.status, 429);
    assert.equal((await exhausted.json()).error.code, "quota_exhausted");

    store.setStatus(issued.record.id, "revoked");
    const revoked = await fetch(`${baseUrl}/v1/account`, { headers: { "x-api-key": issued.apiKey } });
    assert.equal(revoked.status, 403);
  } finally {
    server.close();
    await once(server, "close");
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
