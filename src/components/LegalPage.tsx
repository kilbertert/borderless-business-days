import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Back to calculator</Link>
      <header>
        <p className="eyebrow">Effective July 29, 2026</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="legal-copy">{children}</div>
      <nav className="legal-nav" aria-label="Legal pages">
        <Link href="/terms/">Terms</Link>
        <Link href="/privacy/">Privacy</Link>
        <Link href="/refund/">Refunds</Link>
        <Link href="/pilot/">API Pilot</Link>
      </nav>
    </main>
  );
}
