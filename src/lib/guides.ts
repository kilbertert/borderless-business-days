export type Guide = {
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  calculatorLabel: string;
  example: {
    countries: string[];
    marketLabel: string;
    start: string;
    amount: number;
    termLabel: string;
  };
  facts: Array<{ label: string; value: string }>;
  sections: Array<{
    title: string;
    paragraphs: string[];
    points?: string[];
  }>;
  faq: Array<{ question: string; answer: string }>;
};

export const guides = {
  "international-payment-due-date-calculator": {
    title: "International payment due-date calculator",
    description: "Calculate an international payment deadline using business days shared by the buyer and seller markets.",
    eyebrow: "Cross-border payment operations",
    intro: "Turn a payment term into a date that is workable in every jurisdiction named in the agreement, while keeping weekends and public holiday conflicts visible.",
    calculatorLabel: "Calculate a payment due date",
    example: {
      countries: ["US", "GB"],
      marketLabel: "United States and United Kingdom",
      start: "2026-08-03",
      amount: 30,
      termLabel: "30 shared business days",
    },
    facts: [
      { label: "Use when", value: "Payment terms use business days" },
      { label: "Count", value: "Shared open weekdays" },
      { label: "Output", value: "A defensible target date" },
    ],
    sections: [
      {
        title: "Define when the payment clock starts",
        paragraphs: [
          "A due date is only as reliable as its trigger. Confirm whether the term starts on the invoice date, receipt date, acceptance date, shipment date, or another event defined in the agreement.",
          "Use that event date as the calculator start date. Keep evidence of the trigger separately from the calendar calculation.",
        ],
      },
      {
        title: "Choose the calendars that can block settlement",
        paragraphs: [
          "Include the markets whose banking, treasury, approval, or operational closures can prevent the payment from being processed. A buyer and seller pair is a practical starting point, but the contract and payment rail remain authoritative.",
        ],
        points: [
          "Exclude Saturdays and Sundays under the calculator's Monday-Friday workweek.",
          "Exclude a weekday when any selected market has a public holiday.",
          "Treat bank cutoffs, currency holidays, and local settlement rules as separate checks.",
        ],
      },
      {
        title: "Preserve the calculation with the commercial record",
        paragraphs: [
          "Share the calculation URL or export the relevant dates before the deadline is confirmed. This makes the selected markets, start date, and holiday conflicts reviewable without turning the calculator into the contract itself.",
        ],
      },
    ],
    faq: [
      { question: "Does the calculator apply a payment grace period?", answer: "No. Add only the business-day term you intend to calculate. Contractual grace periods and notice rules must be applied separately." },
      { question: "Are bank holidays and public holidays always identical?", answer: "No. The dataset covers published public holiday rules. Verify bank, currency, clearing, and cutoff calendars for the payment method you use." },
      { question: "Can the API automate recurring invoice deadlines?", answer: "Yes, subject to pilot qualification. The API can add shared business days and return the holiday conflicts used in the calculation." },
    ],
  },
  "calculate-deadline-across-two-countries": {
    title: "How to calculate a deadline across two countries",
    description: "Calculate a cross-border deadline that excludes weekends and public holidays in both selected countries.",
    eyebrow: "International deadline planning",
    intro: "Model two jurisdictions as one operating calendar so a deadline lands on a weekday when both sides can act.",
    calculatorLabel: "Calculate a two-country deadline",
    example: {
      countries: ["US", "DE"],
      marketLabel: "United States and Germany",
      start: "2026-09-01",
      amount: 10,
      termLabel: "10 shared business days",
    },
    facts: [
      { label: "Use when", value: "Two teams must act" },
      { label: "Method", value: "Combine both calendars" },
      { label: "Review", value: "Inspect every blocked weekday" },
    ],
    sections: [
      {
        title: "Translate the rule into calendar inputs",
        paragraphs: [
          "Identify the start event, the number of business days, whether the start date counts, and the jurisdictions whose closures matter. Do not silently replace a contractual definition with a generic local convention.",
        ],
      },
      {
        title: "Count only dates shared by both countries",
        paragraphs: [
          "A shared business day is a Monday-Friday date that is not a public holiday in either selected market. If one country is closed, the date is excluded from the shared count.",
        ],
        points: [
          "Use Add days when the rule specifies a number of business days.",
          "Use Count range when comparing two proposed dates.",
          "Use Find window when several consecutive shared workdays are required.",
        ],
      },
      {
        title: "Check time zones and local legal definitions",
        paragraphs: [
          "The resulting date is planning support, not a universal legal conclusion. Time-zone cutoffs, local working Saturdays, sector closures, and jurisdiction-specific definitions may change the operational or statutory answer.",
        ],
      },
    ],
    faq: [
      { question: "What happens when only one country has a holiday?", answer: "That weekday is excluded because it is not open across every selected market." },
      { question: "Can I count backward from a filing date?", answer: "Yes. Choose Add days and enter a negative business-day value to calculate backward." },
      { question: "Does this replace local legal advice?", answer: "No. Use it to expose calendar conflicts and support planning, then verify statutory or contractual deadlines locally." },
    ],
  },
  "cross-border-delivery-date-calculator": {
    title: "Cross-border delivery date calculator",
    description: "Estimate a cross-border delivery or handoff date using business days shared by the origin and destination markets.",
    eyebrow: "International delivery planning",
    intro: "Calculate an operational target date without assuming that every weekday is workable for teams, warehouses, customs brokers, or customers in both markets.",
    calculatorLabel: "Calculate a delivery target",
    example: {
      countries: ["US", "CN"],
      marketLabel: "United States and China",
      start: "2026-10-01",
      amount: 15,
      termLabel: "15 shared business days",
    },
    facts: [
      { label: "Use when", value: "Markets share a handoff" },
      { label: "Model", value: "Operational open days" },
      { label: "Separate", value: "Transit and customs time" },
    ],
    sections: [
      {
        title: "Separate workday availability from transit duration",
        paragraphs: [
          "Shared business days answer when both selected markets are operational. They do not estimate carrier transit, customs clearance, port congestion, weather, or last-mile performance.",
          "Use the calculator for the calendar portion of the estimate, then add service-specific durations and buffers separately.",
        ],
      },
      {
        title: "Include every market required for the handoff",
        paragraphs: [
          "Select the origin and destination markets and add any jurisdiction whose approval or processing is required before delivery can proceed. A date is counted only when all selected markets are open.",
        ],
        points: [
          "Start from the confirmed dispatch, acceptance, or readiness date.",
          "Add the agreed number of shared operational days.",
          "Review holiday conflicts around peak shutdown periods before communicating the target.",
        ],
      },
      {
        title: "Communicate a target with its assumptions",
        paragraphs: [
          "Record the selected markets, start event, business-day term, and any separate carrier or customs assumptions. A transparent target is easier to revise when one part of the delivery chain changes.",
        ],
      },
    ],
    faq: [
      { question: "Does the result include shipping transit time?", answer: "Only when you deliberately express that duration as shared business days. Carrier and customs estimates should otherwise be added separately." },
      { question: "Can I include more than two markets?", answer: "Yes. The calculator supports up to eight markets when a delivery depends on additional approval or processing locations." },
      { question: "Can the API return the holiday conflicts?", answer: "Yes. The API pilot can return the markets, dates, and public holiday conflicts behind a calculation." },
    ],
  },
} satisfies Record<string, Guide>;

export type GuideSlug = keyof typeof guides;
export const guideSlugs = Object.keys(guides) as GuideSlug[];

export function guidePath(slug: GuideSlug) {
  return `/guides/${slug}/`;
}
