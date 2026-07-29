import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" intro="The Founding API Pilot is manually approved and fulfilled. These rules keep the payment and delivery record clear for both parties.">
      <section><h2>1. Before activation</h2><p>An approved customer may request cancellation before API access is activated. The amount received can be refunded provided fulfillment has not begun.</p></section>
      <section><h2>2. Activation failure</h2><p>If the agreed access cannot be activated within five business days after the payment is shown as cleared in Payoneer, the customer is eligible for a refund of the amount received.</p></section>
      <section><h2>3. After activation</h2><p>After credentials are issued, a refund is available when the agreed service cannot materially be delivered and a reasonable attempt to restore or replace access has failed. Changes of mind, unused request allowance, integration work outside the agreed scope, or customer-side configuration problems are not normally refundable.</p></section>
      <section><h2>4. How refunds are handled</h2><p>Refund requests must identify the business customer, Payoneer transaction reference, and reason without publishing sensitive payment information. Approved refunds are returned through an available compliant payment route. Payoneer fees, bank fees, and currency conversion differences are governed by the relevant provider and may not be recoverable.</p></section>
      <section><h2>5. No automatic renewal</h2><p>The 50 USD Founding API Pilot is a one-time payment. No recurring charge is created, so cancellation is not required to prevent renewal.</p></section>
    </LegalPage>
  );
}
