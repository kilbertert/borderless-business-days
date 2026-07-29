# Market research

## Source path

The product follows the discovery loop described by the Chinese independent-developer community:

1. Use curated open-source indexes to identify durable tool categories.
2. Inspect products already serving international users.
3. narrow the category to a small problem with clear search intent and no paid API dependency.

## Comparable products and infrastructure

| Reference | What it validates | Gap used here |
| --- | --- | --- |
| [World Holidays](https://worldholidays.me/) | Teams compare public holidays across multiple countries. | Comparison is useful, but users still need to calculate a defensible deadline or clean work window. |
| [Nager.Date](https://date.nager.at/) | Developers and businesses consume structured worldwide holiday data. | API-first data access does not answer multi-jurisdiction planning questions directly. |
| [Office Holidays](https://www.officeholidays.com/) | Country and holiday pages can attract long-tail search traffic. | The experience is content-heavy and primarily organized one country at a time. |
| [date-holidays](https://github.com/commenthol/date-holidays) | A maintained rules engine can eliminate a paid data API from the MVP. | It is a library rather than a decision-support product. |
| Public business-day calculators | Users actively search for date arithmetic and working-day counts. | Most calculators support one calendar or a manually entered holiday list. |

## Positioning

**Category:** cross-border business-day calculator.

**Primary promise:** find dates that are workable in every selected jurisdiction.

**Initial users:** distributed product teams, finance operations, legal operations, logistics teams, and software products that calculate international deadlines.

**Differentiation:** up to eight markets are treated as one operating calendar. The result explains each conflict and can be exported as CSV or ICS.

## MVP constraints

- Public holidays only.
- Monday-Friday workweek assumption.
- Five generated calendar years.
- Planning estimates rather than legal advice.
- No authentication, database, paid API, or customer data collection.

These constraints keep the public calculator fast and inexpensive while exposing demand for saved teams, alerts, reports, and API access.
