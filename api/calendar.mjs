import { readFileSync } from "node:fs";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 730;

export class CalendarValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CalendarValidationError";
  }
}

function isNormalizedDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function loadDataset(datasetPath) {
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
  if (!dataset || Array.isArray(dataset) || typeof dataset !== "object") {
    throw new Error("Holiday dataset is invalid.");
  }
  const validYears = Array.isArray(dataset.years)
    && dataset.years.length > 0
    && dataset.years.every((year, index, years) => Number.isInteger(year) && (index === 0 || year === years[index - 1] + 1));
  const validCountries = validYears
    && Array.isArray(dataset.countries)
    && dataset.countries.length > 0
    && dataset.countries.every((country) => typeof country?.code === "string"
      && /^[A-Z]{2}$/.test(country.code)
      && typeof country.name === "string"
      && country.name.trim().length > 0
      && country.holidays
      && typeof country.holidays === "object"
      && dataset.years.every((year) => Array.isArray(country.holidays[year])
        && country.holidays[year].every((holiday) => holiday
          && typeof holiday.name === "string"
          && holiday.name.trim().length > 0
          && isNormalizedDate(holiday.date)
          && holiday.date.startsWith(`${year}-`)))
      && Object.entries(country.holidays).every(([year, holidays]) => /^\d{4}$/.test(year)
        && Array.isArray(holidays)
        && holidays.every((holiday) => holiday
          && typeof holiday.name === "string"
          && holiday.name.trim().length > 0
          && isNormalizedDate(holiday.date)
          && holiday.date.startsWith(`${year}-`))));
  const validCountryCodes = validCountries && new Set(dataset.countries.map((country) => country.code)).size === dataset.countries.length;
  const validAttribution = dataset.attribution
    && typeof dataset.attribution.name === "string"
    && typeof dataset.attribution.url === "string"
    && typeof dataset.attribution.license === "string";
  if (!validYears || !validCountries || !validCountryCodes || !validAttribution || typeof dataset.generatedAt !== "string" || !dataset.generatedAt) {
    throw new Error("Holiday dataset is invalid.");
  }
  return dataset;
}

export function parseDate(value) {
  if (!isNormalizedDate(value)) throw new CalendarValidationError(`Invalid date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
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
    throw new CalendarValidationError("Countries must contain between 1 and 8 market codes.");
  }
  const codes = [...new Set(values.map((value) => String(value).trim().toUpperCase()))];
  if (codes.length !== values.length) throw new CalendarValidationError("Country codes must be unique.");
  const known = new Map(dataset.countries.map((country) => [country.code, country]));
  for (const code of codes) {
    if (!/^[A-Z]{2}$/.test(code) || !known.has(code)) throw new CalendarValidationError(`Unsupported country code: ${code}`);
  }
  return codes;
}

export function validateDatasetDate(dataset, value) {
  parseDate(value);
  const minimum = `${dataset.years[0]}-01-01`;
  const maximum = `${dataset.years.at(-1)}-12-31`;
  if (value < minimum || value > maximum) {
    throw new CalendarValidationError(`Date must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function countriesForCodes(dataset, countryCodes) {
  const selected = new Set(countryCodes);
  return dataset.countries.filter((country) => selected.has(country.code)).map(({ code, name }) => ({ code, name }));
}

export function validateRange(dataset, start, end) {
  validateDatasetDate(dataset, start);
  validateDatasetDate(dataset, end);
  const span = daysBetween(start, end);
  if (span < 0) throw new CalendarValidationError("End date must be on or after the start date.");
  if (span > MAX_RANGE_DAYS) throw new CalendarValidationError("Date range cannot exceed two years.");
  return { start, end, span };
}

export function validateBusinessDayAmount(amount) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    throw new CalendarValidationError("Business days must be a non-zero integer between -500 and 500.");
  }
  return amount;
}

export function validateWindowRequest(dataset, start, horizonDays, businessDays) {
  validateDatasetDate(dataset, start);
  if (!Number.isInteger(horizonDays) || horizonDays < 7 || horizonDays > 365) {
    throw new CalendarValidationError("Search horizon must be between 7 and 365 days.");
  }
  if (!Number.isInteger(businessDays) || businessDays < 1 || businessDays > 20) {
    throw new CalendarValidationError("Window length must be between 1 and 20 business days.");
  }
  const end = shiftDate(start, horizonDays - 1);
  validateDatasetDate(dataset, end);
  return { start, end, horizonDays, businessDays };
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
  const { span } = validateRange(dataset, start, end);

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
  validateBusinessDayAmount(amount);

  const direction = amount > 0 ? 1 : -1;
  const target = Math.abs(amount);
  const holidayIndex = buildHolidayIndex(dataset, countryCodes);
  const examined = [];
  let cursor = start;
  let counted = 0;

  while (counted < target) {
    cursor = shiftDate(cursor, direction);
    try {
      validateDatasetDate(dataset, cursor);
    } catch (error) {
      throw new CalendarValidationError("Unable to resolve the requested date.", { cause: error });
    }
    const weekday = parseDate(cursor).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const conflicts = holidayIndex.get(cursor) ?? [];
    const day = { date: cursor, weekday, weekend, conflicts, isSharedBusinessDay: !weekend && conflicts.length === 0 };
    examined.push(day);
    if (day.isSharedBusinessDay) counted += 1;
    if (examined.length > 1_000) throw new CalendarValidationError("Unable to resolve the requested date.");
  }

  return { result: cursor, examined };
}

export function findSharedWindows(dataset, countryCodes, start, horizonDays, businessDays) {
  const { end } = validateWindowRequest(dataset, start, horizonDays, businessDays);
  const days = analyzeRange(dataset, countryCodes, start, end);
  const sharedDays = days.filter((day) => day.isSharedBusinessDay);
  const dayPositions = new Map(days.map((day, index) => [day.date, index]));
  const windows = [];

  for (let index = 0; index <= sharedDays.length - businessDays; index += 1) {
    const slice = sharedDays.slice(index, index + businessDays);
    const first = slice[0];
    const last = slice.at(-1);
    if (!first || !last) continue;
    const firstIndex = dayPositions.get(first.date);
    const lastIndex = dayPositions.get(last.date);
    if (firstIndex === undefined || lastIndex === undefined) continue;
    const between = days.slice(firstIndex, lastIndex + 1);
    if (between.some((day) => !day.weekend && !day.isSharedBusinessDay)) continue;
    windows.push({ start: first.date, end: last.date, businessDays, calendarDays: daysBetween(first.date, last.date) + 1 });
    if (windows.length === 5) break;
  }

  return { end, days, windows };
}
