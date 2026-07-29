"use client";

import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  Clipboard,
  Code2,
  Download,
  FileDown,
  Globe2,
  Minus,
  Plus,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import holidayDataJson from "@/data/holidays.json";
import {
  addSharedBusinessDays,
  analyzeRange,
  findSharedWindows,
  formatHumanDate,
  monthKey,
  shiftDate,
  summarizeDays,
} from "@/lib/calendar";
import { daysToCsv, daysToIcs, downloadText } from "@/lib/exports";
import type { CalendarDay, HolidayDataset, SharedWindow } from "@/lib/types";
import { CountryPicker } from "./CountryPicker";
import { MonthGrid } from "./MonthGrid";

const dataset = holidayDataJson as HolidayDataset;
const EMPTY_DAYS: CalendarDay[] = [];
const MODES = [
  { id: "range", label: "Count range" },
  { id: "add", label: "Add days" },
  { id: "window", label: "Find window" },
] as const;
type Mode = (typeof MODES)[number]["id"];

type PlannerResult = {
  days: CalendarDay[];
  headline: string;
  detail: string;
  windows?: SharedWindow[];
};

function clampToDataset(value: string) {
  const minimum = `${dataset.years[0]}-01-01`;
  const maximum = `${dataset.years.at(-1)}-12-31`;
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function nextMonth(value: string) {
  const [year, month] = monthKey(value).split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function NumberStepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="stepper" aria-label={label}>
      <button type="button" title={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Minus size={15} aria-hidden="true" />
      </button>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
      />
      <button type="button" title={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Planner() {
  const generatedDate = clampToDataset(dataset.generatedAt.slice(0, 10));
  const [mode, setMode] = useState<Mode>("range");
  const [countryCodes, setCountryCodes] = useState(["US", "GB", "CN"]);
  const [start, setStart] = useState(generatedDate);
  const [end, setEnd] = useState(shiftDate(generatedDate, 45));
  const [amount, setAmount] = useState(10);
  const [windowLength, setWindowLength] = useState(5);
  const [horizon, setHorizon] = useState(90);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedCountries = (params.get("countries") ?? "")
        .split(",")
        .filter((code) => dataset.countries.some((country) => country.code === code));
      const requestedMode = params.get("mode") as Mode | null;
      if (requestedCountries.length) setCountryCodes(requestedCountries.slice(0, 8));
      if (MODES.some((item) => item.id === requestedMode)) setMode(requestedMode as Mode);
      const requestedStart = params.get("start");
      const requestedEnd = params.get("end");
      if (requestedStart) setStart(clampToDataset(requestedStart));
      if (requestedEnd) setEnd(clampToDataset(requestedEnd));
    });
  }, []);

  const result = useMemo<{ value?: PlannerResult; error?: string }>(() => {
    try {
      if (mode === "range") {
        const days = analyzeRange(dataset, countryCodes, start, end);
        const summary = summarizeDays(days);
        return {
          value: {
            days,
            headline: `${summary.sharedBusinessDays} shared business days`,
            detail: `${summary.availabilityRate}% of weekdays are open across every selected market.`,
          },
        };
      }
      if (mode === "add") {
        const calculation = addSharedBusinessDays(dataset, countryCodes, start, amount);
        const days = [...calculation.examined].sort((left, right) => left.date.localeCompare(right.date));
        return {
          value: {
            days,
            headline: formatHumanDate(calculation.result, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
            detail: `${Math.abs(amount)} shared business days ${amount > 0 ? "after" : "before"} ${formatHumanDate(start)}.`,
          },
        };
      }
      const windows = findSharedWindows(dataset, countryCodes, start, horizon, windowLength);
      const days = analyzeRange(dataset, countryCodes, start, shiftDate(start, horizon - 1));
      return {
        value: {
          days,
          windows,
          headline: windows.length ? formatHumanDate(windows[0].start, { month: "long", day: "numeric", year: "numeric" }) : "No clean window found",
          detail: windows.length
            ? `Earliest ${windowLength}-day shared window ends ${formatHumanDate(windows[0].end)}.`
            : `Try a shorter window or extend the ${horizon}-day horizon.`,
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Unable to calculate this range." };
    }
  }, [amount, countryCodes, end, horizon, mode, start, windowLength]);

  const selectedCountries = dataset.countries.filter((country) => countryCodes.includes(country.code));
  const days = result.value?.days ?? EMPTY_DAYS;
  const summary = summarizeDays(days);
  const conflicts = days.filter((day) => !day.weekend && day.conflicts.length > 0);
  const statusByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const calendarStart = days[0]?.date ?? start;
  const minimumDate = `${dataset.years[0]}-01-01`;
  const maximumDate = `${dataset.years.at(-1)}-12-31`;

  const copyShareLink = async () => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      countries: countryCodes.join(","),
      mode,
      start,
      end,
    }).toString();
    window.history.replaceState({}, "", url);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Borderless Business Days home">
          <span className="brand-mark"><Globe2 size={19} aria-hidden="true" /></span>
          <span>Borderless Business Days</span>
        </Link>
        <nav>
          <a href="#method">Method</a>
          <a href="#data">Data</a>
          <Link className="nav-command" href="/pilot/">
            <Code2 size={16} aria-hidden="true" /> API pilot
          </Link>
        </nav>
      </header>

      <main>
        <section className="workspace-intro">
          <div>
            <p className="eyebrow">Cross-border planning calculator</p>
            <h1>Borderless Business Days</h1>
            <p>Count defensible working days across jurisdictions before you set a launch, payment, delivery, or filing deadline.</p>
          </div>
          <div className="status-note"><span /> Holiday data loaded for {dataset.countries.length} markets</div>
        </section>

        <section className="planner-shell" aria-label="Business day planner">
          <aside className="controls-panel">
            <div className="panel-heading">
              <span>Planner</span>
              <span>Mon-Fri workweek</span>
            </div>

            <div className="control-group">
              <label>Markets</label>
              <CountryPicker countries={dataset.countries} selectedCodes={countryCodes} onChange={setCountryCodes} />
            </div>

            <div className="control-group">
              <label>Calculation</label>
              <div className="segmented-control">
                {MODES.map((item) => (
                  <button type="button" key={item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="date-fields">
              <label>
                <span>Start date</span>
                <input type="date" min={minimumDate} max={maximumDate} value={start} onChange={(event) => setStart(event.target.value)} />
              </label>
              {mode === "range" ? (
                <label>
                  <span>End date</span>
                  <input type="date" min={start} max={maximumDate} value={end} onChange={(event) => setEnd(event.target.value)} />
                </label>
              ) : null}
            </div>

            {mode === "add" ? (
              <div className="control-group inline-control">
                <div>
                  <label>Business days</label>
                  <p>Use a negative value to count backward.</p>
                </div>
                <NumberStepper value={amount} min={-100} max={100} onChange={(value) => setAmount(value === 0 ? 1 : value)} label="business days" />
              </div>
            ) : null}

            {mode === "window" ? (
              <>
                <div className="control-group inline-control">
                  <div>
                    <label>Window length</label>
                    <p>Shared business days</p>
                  </div>
                  <NumberStepper value={windowLength} min={1} max={20} onChange={setWindowLength} label="window length" />
                </div>
                <label className="select-field">
                  <span>Search horizon</span>
                  <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                    <option value={30}>Next 30 days</option>
                    <option value={60}>Next 60 days</option>
                    <option value={90}>Next 90 days</option>
                    <option value={180}>Next 180 days</option>
                    <option value={365}>Next 365 days</option>
                  </select>
                </label>
              </>
            ) : null}

            <div className="selected-market-list">
              {selectedCountries.map((country) => (
                <div key={country.code}>
                  <span className="country-code">{country.code}</span>
                  <span>{country.name}</span>
                  <Check size={15} aria-hidden="true" />
                </div>
              ))}
            </div>
          </aside>

          <div className="results-panel">
            <div className="result-toolbar">
              <div>
                <span className="result-label">Result</span>
                <span>{countryCodes.join(" + ")}</span>
              </div>
              <div className="icon-actions">
                <button type="button" title="Copy share link" aria-label="Copy share link" onClick={copyShareLink}>
                  {copied ? <Clipboard size={17} /> : <Share2 size={17} />}
                </button>
                <button type="button" title="Download CSV" aria-label="Download CSV" onClick={() => downloadText("borderless-business-days.csv", daysToCsv(days), "text/csv;charset=utf-8")}>
                  <FileDown size={17} />
                </button>
                <button type="button" title="Download holiday calendar" aria-label="Download holiday calendar" onClick={() => downloadText("borderless-holidays.ics", daysToIcs(days), "text/calendar;charset=utf-8")}>
                  <Download size={17} />
                </button>
              </div>
            </div>

            {result.error ? <div className="error-banner">{result.error}</div> : null}
            {result.value ? (
              <>
                <div className="result-lead">
                  <p>{mode === "add" ? "Resolved date" : mode === "window" ? "Best opening" : "Shared availability"}</p>
                  <strong>{result.value.headline}</strong>
                  <span>{result.value.detail}</span>
                </div>

                {result.value.windows ? (
                  <div className="window-list">
                    {result.value.windows.map((window, index) => (
                      <div key={`${window.start}-${window.end}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{formatHumanDate(window.start)} <ArrowRight size={15} /> {formatHumanDate(window.end)}</strong>
                        <small>{window.businessDays} workdays / {window.calendarDays} calendar days</small>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="stats-grid">
                  <div><CalendarCheck size={17} /><span>Shared days</span><strong>{summary.sharedBusinessDays}</strong></div>
                  <div><CalendarDays size={17} /><span>Weekdays checked</span><strong>{summary.weekdays}</strong></div>
                  <div><Globe2 size={17} /><span>Market conflicts</span><strong>{summary.blockedWeekdays}</strong></div>
                  <div><span className="rate-mark">%</span><span>Availability</span><strong>{summary.availabilityRate}%</strong></div>
                </div>

                <div className="calendar-legend">
                  <span><i className="legend-shared" /> Shared business day</span>
                  <span><i className="legend-conflict" /> Holiday conflict</span>
                  <span><i className="legend-weekend" /> Weekend / outside range</span>
                </div>
                <div className="calendar-pair">
                  <MonthGrid month={calendarStart} statusByDate={statusByDate} />
                  <MonthGrid month={nextMonth(calendarStart)} statusByDate={statusByDate} />
                </div>

                <div className="conflict-section">
                  <div className="section-heading">
                    <div><h2>Holiday conflicts</h2><p>Weekdays that remove at least one selected market.</p></div>
                    <span>{conflicts.length} dates</span>
                  </div>
                  <div className="conflict-table">
                    {conflicts.slice(0, 10).map((day) => (
                      <div key={day.date}>
                        <time>{formatHumanDate(day.date, { month: "short", day: "numeric" })}</time>
                        <div>{day.conflicts.map((conflict) => <span key={`${conflict.countryCode}-${conflict.name}`}><b>{conflict.countryCode}</b>{conflict.name}</span>)}</div>
                      </div>
                    ))}
                    {!conflicts.length ? <p className="empty-state">No weekday holiday conflicts in this result.</p> : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="method-band" id="method">
          <div className="section-heading wide">
            <div><p className="eyebrow">Decision support, not another holiday list</p><h2>From public holidays to defensible dates</h2></div>
            <p>Built for distributed teams, cross-border finance, legal operations, and anyone who needs the same date to be workable in more than one jurisdiction.</p>
          </div>
          <div className="method-grid">
            <div><span>01</span><h3>Combine markets</h3><p>Choose up to eight jurisdictions and evaluate them as one operating calendar.</p></div>
            <div><span>02</span><h3>Expose conflicts</h3><p>See exactly which market blocks each weekday and export an audit-ready CSV.</p></div>
            <div><span>03</span><h3>Commit with context</h3><p>Share the calculation or export holiday events before a deadline enters the plan.</p></div>
          </div>
        </section>

        <section className="pilot-band" id="api-pilot">
          <div className="pilot-copy">
            <p className="eyebrow">Applications open · B2B only</p>
            <h2>Founding API Pilot</h2>
            <p>
              A prepaid 30-day pilot for teams that need cross-border business-day calculations inside their own workflow.
              We confirm the use case and activation date before sending a Payoneer payment link.
            </p>
            <div className="pilot-inclusions" aria-label="Pilot inclusions">
              <span><Check size={15} aria-hidden="true" /> Up to 1,000 API requests</span>
              <span><Check size={15} aria-hidden="true" /> Email onboarding</span>
              <span><Check size={15} aria-hidden="true" /> No automatic renewal</span>
            </div>
          </div>
          <div className="pilot-offer">
            <span>One-time pilot</span>
            <strong><small>$</small>50 <small>USD</small></strong>
            <p>30 days from activation</p>
            <Link href="/pilot/">Review the pilot <ArrowRight size={16} aria-hidden="true" /></Link>
            <small>Payment is requested only after business qualification and scope confirmation.</small>
          </div>
        </section>

        <section className="comparison-band">
          <div className="section-heading wide">
            <div><p className="eyebrow">Popular planning routes</p><h2>Country comparisons</h2></div>
          </div>
          <div className="comparison-links">
            <Link href="/compare/us-uk/">US + UK <ArrowRight size={16} /></Link>
            <Link href="/compare/us-cn/">US + China <ArrowRight size={16} /></Link>
            <Link href="/compare/us-in/">US + India <ArrowRight size={16} /></Link>
            <Link href="/compare/gb-de/">UK + Germany <ArrowRight size={16} /></Link>
            <Link href="/compare/au-nz/">Australia + NZ <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>

      <footer id="data">
        <div>
          <strong>Borderless Business Days</strong>
          <span>Planning estimates for Monday-Friday teams. Verify statutory and contractual deadlines with local counsel.</span>
          <span className="footer-links"><Link href="/pilot/">API Pilot</Link><Link href="/terms/">Terms</Link><Link href="/privacy/">Privacy</Link><Link href="/refund/">Refunds</Link></span>
        </div>
        <div>Holiday data: <a href={dataset.attribution.url} target="_blank" rel="noreferrer">{dataset.attribution.name}</a> ({dataset.attribution.license}) · Updated {formatHumanDate(dataset.generatedAt.slice(0, 10))}</div>
      </footer>
    </>
  );
}
