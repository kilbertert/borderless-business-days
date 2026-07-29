import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarCheck, Globe2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import holidayDataJson from "@/data/holidays.json";
import { analyzeRange, formatHumanDate, summarizeDays } from "@/lib/calendar";
import { comparisonPairs, type ComparisonPair } from "@/lib/pairs";
import type { HolidayDataset } from "@/lib/types";

const dataset = holidayDataJson as HolidayDataset;
const year = dataset.years.includes(2026) ? 2026 : dataset.years[1];

export function generateStaticParams() {
  return Object.keys(comparisonPairs).map((pair) => ({ pair }));
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair } = await params;
  const comparison = comparisonPairs[pair as ComparisonPair];
  if (!comparison) return {};
  return {
    title: `${comparison.title} Shared Business Days in ${year}`,
    description: `Calculate shared business days and public holiday conflicts between ${comparison.title} in ${year}.`,
  };
}

export default async function ComparisonPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const comparison = comparisonPairs[pair as ComparisonPair];
  if (!comparison) notFound();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const days = analyzeRange(dataset, [comparison.left, comparison.right], start, end);
  const summary = summarizeDays(days);
  const conflicts = days.filter((day) => !day.weekend && day.conflicts.length > 0);
  const toolQuery = `/?countries=${comparison.left},${comparison.right}&mode=range&start=${start}&end=${end}`;

  return (
    <main className="comparison-page">
      <Link className="back-link" href="/"><ArrowLeft size={16} /> Calculator</Link>
      <header>
        <p className="eyebrow">Cross-border calendar guide</p>
        <h1>{comparison.title} shared business days in {year}</h1>
        <p>Plan deadlines and delivery windows around the public holidays that affect either market.</p>
      </header>
      <section className="comparison-summary">
        <div><CalendarCheck size={20} /><span>Shared business days</span><strong>{summary.sharedBusinessDays}</strong></div>
        <div><Globe2 size={20} /><span>Blocked weekdays</span><strong>{summary.blockedWeekdays}</strong></div>
        <div><span className="rate-mark">%</span><span>Weekday availability</span><strong>{summary.availabilityRate}%</strong></div>
      </section>
      <section className="comparison-copy">
        <div>
          <h2>What the calculation means</h2>
          <p>A shared business day is a Monday-Friday date that is not a public holiday in either selected country. Weekends and any weekday holiday in either jurisdiction are excluded.</p>
          <p>This is suitable for planning launches, operational handoffs, payment windows, and internal milestones. Statutory or contractual deadlines should still be verified locally.</p>
          <Link className="primary-link" href={toolQuery}>Open the live calculator <ArrowRight size={16} /></Link>
        </div>
        <div>
          <h2>First weekday conflicts</h2>
          <div className="seo-conflicts">
            {conflicts.slice(0, 12).map((day) => (
              <div key={day.date}>
                <time>{formatHumanDate(day.date, { month: "short", day: "numeric" })}</time>
                <span>{day.conflicts.map((conflict) => `${conflict.countryCode}: ${conflict.name}`).join(" · ")}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
