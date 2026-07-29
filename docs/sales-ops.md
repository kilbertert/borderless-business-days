# Founding API Pilot sales operations

The public site must not expose a reusable Payoneer payment link as an ecommerce checkout. The link is held in the private developer configuration and sent only after a business customer has been qualified and the requested pilot can be delivered.

## Offer

- Product: Borderless Business Days Founding API Pilot
- Customer: business or professional buyer only
- Price: 50 USD, one-time
- Term: 30 days from activation
- Allowance: up to 1,000 API requests
- Renewal: none; any extension is quoted separately
- Activation target: within two business days after cleared payment

## Private operator files

- Payment link: `/home/claude/.config/borderless-business-days/payoneer-link`
- Sales ledger: `/home/claude/.local/share/borderless-business-days/sales-ledger.csv`

These files are private to the `claude` development account and must never be committed, copied into a public issue, or embedded in the static site.

## Qualification workflow

1. Review the GitHub application for a real business name, public business URL, professional use case, required markets, and expected volume.
2. Confirm that the requested integration can be delivered. Do not request payment before an API key and activation date can be provided.
3. Establish a private contact route using the public company contact page or professional profile supplied in the application.
4. Send the commercial confirmation below and the private Payoneer link.
5. Verify payment inside the receiver's Payoneer account. Do not rely only on a screenshot, forwarded email, or payer message.
6. Add the transaction to the private sales ledger, issue the API key, and record the activation and expiry dates.
7. Send the activation confirmation. Contact the customer seven days before expiry only when they have consented to operational email.

## Commercial confirmation template

```text
Subject: Borderless Business Days Founding API Pilot

We have reviewed your application and can support the agreed use case.

Offer: Founding API Pilot
Price: 50 USD, one-time
Term: 30 days from activation
Allowance: up to 1,000 API requests
Renewal: no automatic renewal
Activation: within two business days after Payoneer confirms cleared payment

Terms: https://kilbertert.github.io/borderless-business-days/terms/
Refund policy: https://kilbertert.github.io/borderless-business-days/refund/

Payoneer payment link:
[read from the private operator file]
```

## Activation template

```text
Subject: Borderless Business Days API Pilot activated

Payment has been confirmed and your pilot is active.

Activation date: YYYY-MM-DD
Expiry date: YYYY-MM-DD
Request allowance: 1,000
API key: [send through the agreed private channel]

The pilot does not renew automatically. Please do not place the API key in a public repository or issue.
```

## Refund handling

Record every request and outcome in the private ledger. Verify the original transaction and customer identity before returning funds. Apply the published refund policy and retain the Payoneer refund reference or other compliant transfer reference.

## Prohibited patterns

- Do not accept self-payments, gifts, personal top-ups, or consumer online-store purchases.
- Do not publish the reusable payment link as a Buy Now button.
- Do not accept money until the agreed service can be delivered.
- Do not issue access based on a payment screenshot.
- Do not store bank or card data, credentials, or confidential customer data in GitHub.
