# Borderless Business Days

Cross-border business day calculator for distributed teams, finance, legal operations, and international delivery planning.

**Live product:** https://borderlessbusinessdays.com/

The app combines public holiday calendars for up to eight markets and supports three workflows:

- Count shared business days across a date range.
- Add or subtract shared business days from a date.
- Find the next uninterrupted multi-day working window.

Results can be shared through URL parameters and exported as CSV or ICS.

## Local development

```bash
pnpm install
pnpm dev
```

The holiday dataset is generated at build time:

```bash
pnpm generate:data
```

## Verification

```bash
pnpm check
```

## Static deployment

The project uses Next.js static export. `main` is deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` and published on `borderlessbusinessdays.com`.

```bash
pnpm build
pnpm start
```

## Data and licensing

Holiday rules come from [date-holidays](https://github.com/commenthol/date-holidays), licensed under ISC and CC-BY-3.0. The generated dataset includes public holidays for 206 markets and five calendar years.

Calculations assume a Monday-Friday workweek. They are planning estimates, not legal advice; statutory and contractual deadlines should be verified locally.

Application code is MIT licensed.

Product positioning and launch material are documented in [`docs/market-research.md`](docs/market-research.md), [`docs/launch-kit.md`](docs/launch-kit.md), and [`docs/launch-distribution.md`](docs/launch-distribution.md). Search ownership, sitemap submission, indexing notifications, and privacy-friendly measurement are documented in [`docs/search-growth-ops.md`](docs/search-growth-ops.md).

## Commercial path

The free calculator validates search demand. Paid extensions are intentionally separated from the MVP:

- Saved teams and reusable calendars.
- Slack and email holiday alerts.
- PDF audit reports.
- Business-day API access and higher-volume usage.

## API pilot service

The authenticated pilot API runs as a separate localhost-only Node.js service with hashed API keys, SQLite quota accounting, and a local administration CLI. Runtime secrets and customer keys remain outside the repository.

- API behavior and operator commands: [`docs/api-pilot.md`](docs/api-pilot.md)
- Payment qualification and fulfillment: [`docs/sales-ops.md`](docs/sales-ops.md)

The service is intentionally not exposed through the GitHub Pages site. A public customer endpoint requires a separately approved HTTPS reverse-proxy or tunnel configuration.
