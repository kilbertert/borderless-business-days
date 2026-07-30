# Search and measurement operations

This runbook covers search ownership, sitemap submission, indexing notifications, and privacy-friendly launch measurement for `borderlessbusinessdays.com`.

## Current public foundation

- Canonical origin: `https://borderlessbusinessdays.com/`
- Sitemap: `https://borderlessbusinessdays.com/sitemap.xml`
- Robots file: `https://borderlessbusinessdays.com/robots.txt`
- DNS and HTTPS proxy: Cloudflare
- Static origin: GitHub Pages

Keep verification records in DNS or the owning search account. Do not commit account identifiers, verification tokens, analytics site tokens, OAuth credentials, or screenshots containing private account details.

## Google Search Console

Use a Domain property so the ownership covers the apex domain, every protocol, and current or future subdomains.

1. Open Google Search Console and add a property.
2. Choose **Domain** and enter `borderlessbusinessdays.com` without a protocol or path.
3. Copy the Google-provided DNS TXT value.
4. In Cloudflare, open the domain, go to **DNS > Records**, and add a TXT record:
   - Name: `@`
   - Content: the exact Google verification value
   - TTL: Auto
5. Confirm the public TXT record without printing the token into logs, then select **Verify** in Search Console.
6. Leave the TXT record in place. Google periodically rechecks ownership.
7. Open **Sitemaps**, submit `https://borderlessbusinessdays.com/sitemap.xml`, and confirm the status is successful.
8. Use URL Inspection to request initial indexing for the homepage and the three action-intent guides. Sitemap submission remains the ongoing discovery mechanism.

Rollback: removing the TXT record can eventually revoke verified ownership. Do not remove it during routine DNS cleanup.

## Bing Webmaster Tools

Import from Google Search Console after the Google Domain property and sitemap are verified. This avoids maintaining a second verification artifact.

1. Sign in to Bing Webmaster Tools.
2. Choose **Import sites from Google Search Console**.
3. Grant read access to the Google account that owns the Domain property.
4. Select `borderlessbusinessdays.com` and import it.
5. Confirm the site is verified and the sitemap appears with a successful status.
6. Keep the Google connection active so Bing can periodically revalidate ownership and import new sitemaps.

Fallback: if import is unavailable, use Bing's DNS CNAME verification. Keep that record in Cloudflare for as long as Bing relies on it.

## Cloudflare Web Analytics

Use Cloudflare Web Analytics automatic setup because the apex domain is proxied through Cloudflare. This keeps the analytics token out of the repository and reports beacons to the site's own `/cdn-cgi/rum` endpoint.

1. In Cloudflare, open **Web Analytics** and add `borderlessbusinessdays.com`.
2. Select automatic setup for the proxied hostname.
3. Keep the default rule that measures public HTML pages across the hostname.
4. After activation, load the production site and confirm Cloudflare injects `https://static.cloudflareinsights.com/beacon.min.js`.
5. Confirm the browser sends a successful `POST` to `/cdn-cgi/rum` and that the dashboard receives a first page view. Data can take several minutes to appear.

Cloudflare Web Analytics is used only for aggregate page views, referrers, and performance metrics. It does not log URL query strings. Do not add custom analytics for calculator inputs, selected markets, dates, API keys, or payment information.

Rollback: use **Web Analytics > Manage site > Disable**. Automatic injection then stops without a code deployment.

## Crawler Hints and IndexNow

Cloudflare Crawler Hints uses cache signals to notify supported search engines through IndexNow when public content changes.

1. In Cloudflare, open **Caching > Configuration** for the domain.
2. Enable **Crawler Hints**.
3. Leave indexing exclusions under application control through `robots.txt`, canonical metadata, or explicit `noindex` directives.

Rollback: disable Crawler Hints in the same Cloudflare configuration screen. The sitemap remains the authoritative discovery source.

## Measurement contract

Use each system for a narrow, auditable purpose:

| Signal | Source | Interpretation |
| --- | --- | --- |
| Search impressions, clicks, queries, and position | Google Search Console and Bing Webmaster Tools | Organic discovery and snippet performance |
| Page views, referrers, top paths, and Core Web Vitals | Cloudflare Web Analytics | Aggregate acquisition and page performance |
| Visits to `/pilot/` | Cloudflare Web Analytics | Directional API Pilot interest, not a completed application |
| Submitted GitHub Pilot issues | Public GitHub issue count with manual qualification | Qualified lead candidates |
| Approved, paid, and activated pilots | Private sales ledger and API administration records | Commercial conversion and fulfillment |

Do not join these sources into visitor-level profiles. Report weekly aggregates and compare campaign periods against the preceding baseline.

## Launch gate

Before directory submissions or Product Hunt:

- Google Domain property is verified and the sitemap status is successful.
- Bing has imported the verified site and sitemap successfully.
- Cloudflare Web Analytics has received production page views.
- Crawler Hints is enabled.
- The live privacy policy discloses Cloudflare delivery and aggregate analytics.
- A seven-day baseline is recorded before evaluating referral campaigns.
