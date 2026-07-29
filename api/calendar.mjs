import { readFileSync } from "node:fs";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 730;

export function loadDataset(datasetPath) {
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
  if (!Array.isArray(dataset.years) || !Array.isArray(dataset.countries) || !dataset.generatedAt) {
    throw new Error("Holiday dataset is invalid.");
  }
  return dataset;
}

export function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(value, days) {
  return formatDate(new Date(parseDate(value).getTime() + days * DAY_MS));
}

export function daysBetween(start, end) {
  return Math.floor((parseDate(end).getTime() - parseDate(start).getTime()) / DAY_MS);
}

export function validateCountries(dataset, values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 8) {
    throw new Error("Countries must contain between 1 and 8 market codes.");
  }
  const codes = [...new Set(values.map((value) => String(value).trim().toUpperCase()))];
  if (codes.length !== values.length) throw new Error("Country codes must be unique.");
  const known = new Map(dataset.countries.map((country) => [country.code, country]));
  for (const code of codes) {
    if (!/^[A-Z]{2}$/.test(code) || !known.has(code)) throw new Error(`Unsupported country code: ${code}`);
  }
  return codes;
}

export function validateDatasetDate(dataset, value) {
  parseDate(value);
  const minimum = `${dataset.years[0]}-01-01`;
  const maximum = `${dataset.years.at(-1)}-12-31`;
  if (value < minimum || value > maximum) {
    throw new Error(`Date must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function countriesForCodes(dataset, countryCodes) {
  const selected = new Set(countryCodes);
  return dataset.countries.filter((country) => selected.has(country.code)).map(({ code, name }) => ({ code, name }));
}

export function buildHolidayIndex(dataset, countryCodes) {
  const selected = new Set(countryCodes);
  const index = new Map();
  for (const country of dataset.countries) {
    if (!selected.has(country.code)) continue;
    for (const holidays of Object.values(country.holidays)) {
      for (const holiday of holidays) {
        const current = index.get(holiday.date) ?? [];
        current.push({ ...holiday, countryCode: country.code, countryName: country.name });
        index.set(holiday.date, current);
      }
    }
  }
  return index;
}

export function analyzeRange(dataset, countryCodes, start, end) {
  validateDatasetDate(dataset, start);
  validateDatasetDate(dataset, end);
  const span = daysBetween(start, end);
  if (span < 0) throw new Error("End date must be on or after the start date.");
  if (span > MAX_RANGE_DAYS) throw new Error("Date range cannot exceed two years.");

  const holidayIndex = buildHolidayIndex(dataset, countryCodes);
  return Array.from({ length: span + 1 }, (_, index) => {
    const date = shiftDate(start, index);
    const weekday = parseDate(date).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const conflicts = holidayIndex.get(date) ?? [];
    return { date, weekday, weekend, conflicts, isSharedBusinessDay: !weekend && conflicts.length === 0 };
  });
}

export function summarizeDays(days) {
  const weekdays = days.filter((day) => !day.weekend);
  const shared = days.filter((day) => day.isSharedBusinessDay);
  const blockedWeekdays = weekdays.filter((day) => day.conflicts.length > 0);
  return {
    calendarDays: days.length,
    weekdays: weekdays.length,
    sharedBusinessDays: shared.length,
    blockedWeekdays: blockedWeekdays.length,
    availabilityRate: weekdays.length ? Math.round((shared.length / weekdays.length) * 100) : 0,
  };
}

export function addSharedBusinessDays(dataset, countryCodes, start, amount) {
  validateDatasetDate(dataset, start);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    throw new Error("Business days must be a non-zero integer between -500 and 500.");
  }

  const direction = amount > 0 ? 1 : -1;
  const target = Math.abs(amount);
  const holidayIndex = buildHolidayIndex(dataset, countryCodes);
  const examined = [];
  let cursor = start;
  let counted = 0;

  while (counted < target) {
    cursor = shiftDate(cursor, direction);
    validateDatasetDate(dataset, cursor);
    const weekday = parseDate(cursor).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const conflicts = holidayIndex.get(cursor) ?? [];
    const day = { date: cursor, weekday, weekend, conflicts, isSharedBusinessDay: !weekend && conflicts.length === 0 };
    examined.push(day);
    if (day.isSharedBusinessDay) counted += 1;
    if (examined.length > 1_000) throw new Error("Unable to resolve the requested date.");
  }

  return { result: cursor, examined };
}

export function findSharedWindows(dataset, countryCodes, start, horizonDays, businessDays) {
  validateDatasetDate(dataset, start);
  if (!Number.isInteger(horizonDays) || horizonDays < 7 || horizonDays > 365) {
    throw new Error("Search horizon must be between 7 and 365 days.");
  }
  if (!Number.isInteger(businessDays) || businessDays < 1 || businessDays > 20) {
    throw new Error("Window length must be between 1 and 20 business days.");
  }

  const end = shiftDate(start, horizonDays - 1);
  validateDatasetDate(dataset, end);
  const days = analyzeRange(dataset, countryCodes, start, end);
  const sharedDays = days.filter((day) => day.isSharedBusinessDay);
  const windows = [];

  for (let index = 0; index <= sharedDays.length - businessDays; index += 1) {
    const slice = sharedDays.slice(index, index + businessDays);
    const first = slice[0];
    const last = slice.at(-1);
    if (!first || !last) continue;
    const between = days.filter((day) => day.date >= first.date && day.date <= last.date);
    if (between.some((day) => !day.weekend && !day.isSharedBusinessDay)) continue;
    windows.push({ start: first.date, end: last.date, businessDays, calendarDays: daysBetween(first.date, last.date) + 1 });
    if (windows.length === 5) break;
  }

  return { end, days, windows };
}
