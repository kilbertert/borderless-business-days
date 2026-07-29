# Borderless Business Days

Cross-border business day calculator for distributed teams, finance, legal operations, and international delivery planning.

**Live product:** https://kilbertert.github.io/borderless-business-days/

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

The project uses Next.js static export. `main` is deployed to GitHub Pages by `.github/workflows/deploy-pages.yml`.

```bash
pnpm build
pnpm start
```

## Data and licensing

Holiday rules come from [date-holidays](https://github.com/commenthol/date-holidays), licensed under ISC and CC-BY-3.0. The generated dataset includes public holidays for 206 markets and five calendar years.

Calculations assume a Monday-Friday workweek. They are planning estimates, not legal advice; statutory and contractual deadlines should be verified locally.

Application code is MIT licensed.

Product positioning and launch material are documented in [`docs/market-research.md`](docs/market-research.md) and [`docs/launch-kit.md`](docs/launch-kit.md).

## Commercial path

The free calculator validates search demand. Paid extensions are intentionally separated from the MVP:

- Saved teams and reusable calendars.
- Slack and email holiday alerts.
- PDF audit reports.
- Business-day API access and higher-volume usage.
