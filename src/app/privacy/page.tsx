import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" intro="This policy explains the limited data involved in the free calculator, pilot applications, and manually fulfilled API access.">
      <section><h2>1. Calculator data</h2><p>The public calculator runs in the browser. Selected markets, dates, and generated planning results are not intentionally transmitted to a Borderless Business Days application server. Shared URLs can contain calculation parameters, so review a URL before distributing it.</p></section>
      <section><h2>2. GitHub applications</h2><p>API pilot applications are submitted through a public GitHub issue. Information posted there is visible publicly and is processed under GitHub&apos;s privacy terms. Applicants should provide only a company website or other public contact route and must not post confidential information, private email addresses, credentials, customer data, or payment details.</p></section>
      <section><h2>3. Payment information</h2><p>Approved payments are processed by Payoneer. Borderless Business Days does not receive or store full card or bank credentials. Payoneer may provide payer identity, company, amount, currency, transaction status, and reference information needed to verify and reconcile a commercial payment.</p></section>
      <section><h2>4. Pilot records</h2><p>For approved pilots, limited operational records may be kept, including business name, public contact route, agreed scope, Payoneer transaction reference, activation date, expiry date, usage allowance, and fulfillment or refund status.</p></section>
      <section><h2>5. Retention and sharing</h2><p>Operational records are retained only as needed to deliver the service, prevent abuse, resolve disputes, and meet accounting or legal obligations. Personal information is not sold. It may be disclosed to service providers or authorities only when needed for delivery, security, compliance, or a valid legal request.</p></section>
      <section><h2>6. Requests</h2><p>A request concerning pilot records can be opened through the GitHub issue tracker without posting sensitive details. A private contact route will be established before identity-specific information is discussed.</p></section>
    </LegalPage>
  );
}
