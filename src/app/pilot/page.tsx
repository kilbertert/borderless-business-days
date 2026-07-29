import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Check, Code2, ShieldCheck } from "lucide-react";
import Link from "next/link";

const applicationUrl = "https://github.com/kilbertert/borderless-business-days/issues/new?template=api-access.yml";

export const metadata: Metadata = {
  title: "Founding API Pilot",
  description: "Apply for a prepaid 30-day B2B pilot of the Borderless Business Days API.",
};

export default function PilotPage() {
  return (
    <main className="sales-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Back to calculator</Link>

      <section className="sales-hero">
        <div>
          <p className="eyebrow">Applications open · Business customers only</p>
          <h1>Put cross-border business-day logic inside your workflow.</h1>
          <p>
            The Founding API Pilot is a manually onboarded, prepaid evaluation for professional teams building deadline,
            settlement, delivery, filing, or international planning tools.
          </p>
          <div className="sales-actions">
            <a className="sales-primary" href={applicationUrl} target="_blank" rel="noreferrer">
              Apply for the pilot <ArrowRight size={16} aria-hidden="true" />
            </a>
            <span>No payment is requested with the application.</span>
          </div>
        </div>

        <aside className="offer-card" aria-label="Founding API Pilot offer">
          <span>Founding API Pilot</span>
          <strong><small>$</small>50 <small>USD</small></strong>
          <p>One-time payment · 30 days from activation</p>
          <ul>
            <li><Check size={15} aria-hidden="true" /> Up to 1,000 API requests</li>
            <li><Check size={15} aria-hidden="true" /> Cross-market business-day calculations</li>
            <li><Check size={15} aria-hidden="true" /> Email onboarding and pilot support</li>
            <li><Check size={15} aria-hidden="true" /> No automatic renewal</li>
          </ul>
        </aside>
      </section>

      <section className="sales-section">
        <div className="section-heading wide">
          <div><p className="eyebrow">A qualified B2B transaction</p><h2>How the pilot works</h2></div>
          <p>The payment step comes only after we confirm that the requested integration can be delivered.</p>
        </div>
        <div className="sales-steps">
          <div><span>01</span><Code2 size={20} aria-hidden="true" /><h3>Apply</h3><p>Describe the business, intended workflow, markets, and expected monthly volume.</p></div>
          <div><span>02</span><ShieldCheck size={20} aria-hidden="true" /><h3>Confirm scope</h3><p>We verify B2B eligibility, technical fit, activation timing, and the named customer.</p></div>
          <div><span>03</span><Check size={20} aria-hidden="true" /><h3>Pay and activate</h3><p>Approved customers receive a Payoneer USD payment link. Access is activated within two business days after cleared payment.</p></div>
        </div>
      </section>

      <section className="sales-grid">
        <article>
          <p className="eyebrow">Good fit</p>
          <h2>Built for professional workflows</h2>
          <ul className="text-list">
            <li>Finance and operations teams validating payment dates.</li>
            <li>Legal or compliance tools calculating cross-market deadlines.</li>
            <li>Delivery systems estimating workable international dates.</li>
            <li>Developer products that need auditable holiday conflicts.</li>
          </ul>
        </article>
        <article>
          <p className="eyebrow">Not a checkout</p>
          <h2>Payment follows approval</h2>
          <p>
            Payoneer payment links are used only for approved commercial services supplied to business or professional customers.
            This page does not provide consumer checkout, self-loading, recurring billing, or an online-store payment gateway.
          </p>
          <div className="legal-inline">
            <Link href="/terms/">Terms</Link>
            <Link href="/privacy/">Privacy</Link>
            <Link href="/refund/">Refund policy</Link>
          </div>
        </article>
      </section>

      <section className="sales-faq">
        <p className="eyebrow">Before you apply</p>
        <h2>Operational details</h2>
        <div>
          <article><h3>When does the 30-day period begin?</h3><p>On the activation date stated in the access email, not on the date the application is submitted.</p></article>
          <article><h3>Is the pilot automatically renewed?</h3><p>No. Any extension or annual plan is quoted and paid separately.</p></article>
          <article><h3>What if access cannot be activated?</h3><p>If we cannot activate the agreed access within five business days of cleared payment, the amount received is refundable under the refund policy.</p></article>
          <article><h3>Is the calculator itself still free?</h3><p>Yes. The public browser-based calculator remains free; the pilot covers API access and onboarding.</p></article>
        </div>
      </section>

      <section className="sales-cta">
        <div><p className="eyebrow">First step</p><h2>Tell us what your workflow needs.</h2></div>
        <a className="sales-primary" href={applicationUrl} target="_blank" rel="noreferrer">Apply on GitHub <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
    </main>
  );
}
