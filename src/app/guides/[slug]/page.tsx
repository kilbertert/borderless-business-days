import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarCheck, Code2, Globe2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import holidayDataJson from "@/data/holidays.json";
import { addSharedBusinessDays, formatHumanDate } from "@/lib/calendar";
import { guidePath, guides, guideSlugs, type GuideSlug } from "@/lib/guides";
import type { HolidayDataset } from "@/lib/types";

const dataset = holidayDataJson as HolidayDataset;
const siteUrl = "https://borderlessbusinessdays.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return guideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug as GuideSlug];
  if (!guide) return {};
  const path = guidePath(slug as GuideSlug);
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: "article",
      url: path,
      siteName: "Borderless Business Days",
      publishedTime: "2026-07-30T00:00:00.000Z",
      modifiedTime: "2026-07-30T00:00:00.000Z",
      images: ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
      images: ["/og.png"],
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides[slug as GuideSlug];
  if (!guide) notFound();

  const calculation = addSharedBusinessDays(dataset, guide.example.countries, guide.example.start, guide.example.amount);
  const resultDate = formatHumanDate(calculation.result, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const conflictCount = calculation.examined.filter((day) => !day.weekend && day.conflicts.length > 0).length;
  const calculatorHref = `/?countries=${guide.example.countries.join(",")}&mode=add&start=${guide.example.start}&amount=${guide.example.amount}`;
  const canonicalUrl = `${siteUrl}${guidePath(slug as GuideSlug)}`;
  const relatedGuides = guideSlugs.filter((item) => item !== slug);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        mainEntityOfPage: canonicalUrl,
        datePublished: "2026-07-30",
        dateModified: "2026-07-30",
        publisher: { "@type": "Organization", name: "Borderless Business Days", url: siteUrl },
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Calculator", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/#guides` },
          { "@type": "ListItem", position: 3, name: guide.title, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <>
      <main className="guide-page">
        <Link href="/" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Calculator</Link>
        <header className="guide-hero">
          <p className="eyebrow">{guide.eyebrow}</p>
          <h1>{guide.title}</h1>
          <p>{guide.intro}</p>
          <div className="guide-actions">
            <Link className="guide-primary-action" href={calculatorHref}>{guide.calculatorLabel} <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className="guide-secondary-action" href="/pilot/"><Code2 size={16} aria-hidden="true" /> Automate with the API</Link>
          </div>
        </header>

        <section className="guide-summary" aria-label="Guide summary">
          {guide.facts.map((fact, index) => (
            <div key={fact.label}>
              {index === 0 ? <CalendarCheck size={19} aria-hidden="true" /> : index === 1 ? <Globe2 size={19} aria-hidden="true" /> : <span className="guide-summary-mark">0{index + 1}</span>}
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </section>

        <section className="guide-example" aria-labelledby="worked-example">
          <div>
            <p className="eyebrow">Worked calendar example</p>
            <h2 id="worked-example">{guide.example.termLabel} across {guide.example.marketLabel}</h2>
            <p>Starting {formatHumanDate(guide.example.start)}, the shared-calendar result is:</p>
          </div>
          <div className="guide-example-result">
            <strong>{resultDate}</strong>
            <span>{calculation.examined.length} calendar dates examined · {conflictCount} public-holiday conflicts</span>
            <Link href={calculatorHref}>Inspect the calculation <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </section>

        <div className="guide-content">
          <aside>
            <p className="eyebrow">Planning method</p>
            <p>Use the same assumptions in the calculator, the commercial record, and any API workflow.</p>
          </aside>
          <div className="guide-sections">
            {guide.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.points ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
              </section>
            ))}
          </div>
        </div>

        <section className="guide-faq" aria-labelledby="guide-faq-title">
          <p className="eyebrow">Common questions</p>
          <h2 id="guide-faq-title">What to verify before committing the date</h2>
          <div>
            {guide.faq.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <nav className="guide-related" aria-label="Related planning guides">
          <div><p className="eyebrow">Continue planning</p><h2>Related guides</h2></div>
          <div className="guide-related-links">
            {relatedGuides.map((item) => (
              <Link key={item} href={guidePath(item)}><span>{guides[item].title}</span><ArrowRight size={16} aria-hidden="true" /></Link>
            ))}
            <Link href="/compare/us-cn/"><span>United States and China shared business days</span><ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </nav>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
