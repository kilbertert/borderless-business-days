import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" intro="These terms cover the free calculator and any separately approved Borderless Business Days API pilot.">
      <section><h2>1. Service scope</h2><p>The public calculator provides planning estimates based on published holiday rules. A paid API pilot is a separate, manually approved B2B service with its scope, activation date, usage allowance, and customer confirmed before payment.</p></section>
      <section><h2>2. Business eligibility</h2><p>The paid pilot is offered only to businesses and professional users purchasing for a commercial purpose. It is not offered as consumer ecommerce checkout, self-loading, a gift, or a general-purpose payment service.</p></section>
      <section><h2>3. Pilot terms</h2><p>Unless a written confirmation says otherwise, the Founding API Pilot costs 50 USD, runs for 30 days from activation, includes up to 1,000 requests, and does not renew automatically. Access credentials may not be resold, published, or shared outside the approved customer organization.</p></section>
      <section><h2>4. Accuracy and permitted use</h2><p>Holiday data and calculations are planning aids, not legal, tax, accounting, or compliance advice. Customers must independently verify statutory, contractual, banking, and filing deadlines. The service may not be used for unlawful activity, security testing without permission, abusive traffic, or infringement of third-party rights.</p></section>
      <section><h2>5. Payment</h2><p>Approved customers receive a Payoneer payment request or payment link. Available payment methods, processing fees, currency conversion, and review times are controlled by Payoneer and the payer&apos;s financial institution. Access is issued only after payment is shown as cleared in the receiver&apos;s Payoneer account.</p></section>
      <section><h2>6. Availability and changes</h2><p>The pilot has no service-level agreement unless agreed in writing. Reasonable maintenance, security controls, rate limits, and changes needed to protect the service may be applied. Material changes to an already paid pilot will not reduce the agreed access period or usage allowance.</p></section>
      <section><h2>7. Refunds</h2><p>Refund eligibility is described in the published Refund Policy. Third-party processing fees and exchange-rate differences remain subject to Payoneer and the payer&apos;s bank.</p></section>
      <section><h2>8. Contact</h2><p>Questions or notices can be submitted through the project&apos;s GitHub issue tracker. Do not place credentials, payment details, private customer data, or confidential deadlines in a public issue.</p></section>
    </LegalPage>
  );
}
