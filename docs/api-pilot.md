# Borderless Business Days API Pilot

The pilot API is a Node.js 24 service that uses the same generated holiday dataset as the public calculator. It has no public HTTP administration endpoints. API keys are issued, inspected, suspended, resumed, extended, and revoked only through the local operator CLI.

## Runtime

- Public endpoint: `https://api.borderlessbusinessdays.com`
- Public health: `https://api.borderlessbusinessdays.com/healthz`
- Public OpenAPI document: `https://api.borderlessbusinessdays.com/openapi.json`
- Loopback origin: `http://127.0.0.1:4181`
- Database: `/home/claude/.local/share/borderless-business-days-api/api.sqlite3`
- Private configuration: `/home/claude/.config/borderless-business-days-api/config.env`
- API user service: `borderless-business-days-api.service`
- Tunnel user service: `borderless-business-days-api-tunnel.service`

Customers must use the public HTTPS endpoint. The Node service remains bound to loopback and is published only through the dedicated Cloudflare Tunnel for `api.borderlessbusinessdays.com`. The public base URL is configured with `BBD_API_PUBLIC_BASE_URL`; Tunnel traffic is trusted only from the configured loopback proxy addresses.

Do not advertise the loopback origin or use a personal blog domain for this service. HTTP administration remains unavailable; API key lifecycle operations stay local to the operator CLI.

SQLite runs in rollback-journal mode so the long-lived systemd service and short-lived operator CLI share one committed database state across the service's private mount namespace. Do not enable WAL while that sandbox boundary remains in place.

## Authentication

Use either header format:

```http
Authorization: Bearer bbd_live_KEY_ID_SECRET
```

```http
X-API-Key: bbd_live_KEY_ID_SECRET
```

Only an HMAC-SHA256 hash is stored in SQLite. The plaintext key is printed once by the issue command and must be sent through a private channel.

## Endpoints

### Account and quota

```http
GET /v1/account
```

### Analyze a range

```http
POST /v1/business-days/analyze
Content-Type: application/json

{
  "countries": ["US", "GB", "CN"],
  "start": "2026-08-01",
  "end": "2026-08-31",
  "includeDays": false
}
```

### Add shared business days

```http
POST /v1/business-days/add
Content-Type: application/json

{
  "countries": ["US", "GB"],
  "start": "2026-08-03",
  "amount": 10
}
```

### Find clean windows

```http
POST /v1/business-days/windows
Content-Type: application/json

{
  "countries": ["US", "GB", "DE"],
  "start": "2026-08-01",
  "horizonDays": 90,
  "businessDays": 5
}
```

Successful calculation responses include `X-Quota-Limit`, `X-Quota-Remaining`, and `X-Quota-Expires-At` headers. Invalid, expired, suspended, revoked, exhausted, and rate-limited keys return structured JSON error codes.

A calculation consumes one request after authentication and payload validation succeed, before the deterministic calendar calculation runs. Missing credentials, malformed JSON, unsupported markets, invalid dates, and other rejected inputs do not consume quota. Per-source and per-key minute limits protect the synchronous SQLite service; only minute-limit responses include `Retry-After`.

## Operator commands

```bash
pnpm api:admin init
pnpm api:admin issue --customer "Example Company" --reference "github-issue-123" --days 30 --limit 1000
pnpm api:admin issue --customer "Internal Test" --days 7 --limit 100 --key-file /home/claude/.config/borderless-business-days-api/internal-test.key
pnpm api:admin list
pnpm api:admin show --id KEY_ID
pnpm api:admin suspend --id KEY_ID
pnpm api:admin resume --id KEY_ID
pnpm api:admin extend --id KEY_ID --days 30
pnpm api:admin revoke --id KEY_ID
```

Never paste a plaintext API key into GitHub, the sales ledger, application logs, or Payoneer notes. Store only the key ID in operational records.
