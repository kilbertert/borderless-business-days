import type {
  CalendarDay,
  HolidayConflict,
  HolidayDataset,
  SharedWindow,
} from "./types";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 730;

export function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(value: string, days: number): string {
  return formatDate(new Date(parseDate(value).getTime() + days * DAY_MS));
}

export function daysBetween(start: string, end: string): number {
  return Math.floor((parseDate(end).getTime() - parseDate(start).getTime()) / DAY_MS);
}

export function buildHolidayIndex(
  dataset: HolidayDataset,
  countryCodes: string[],
): Map<string, HolidayConflict[]> {
  const selected = new Set(countryCodes);
  const index = new Map<string, HolidayConflict[]>();

  for (const country of dataset.countries) {
    if (!selected.has(country.code)) continue;
    for (const holidays of Object.values(country.holidays)) {
      for (const holiday of holidays) {
        const current = index.get(holiday.date) ?? [];
        current.push({
          ...holiday,
          countryCode: country.code,
          countryName: country.name,
        });
        index.set(holiday.date, current);
      }
    }
  }

  return index;
}

export function analyzeRange(
  dataset: HolidayDataset,
  countryCodes: string[],
  start: string,
  end: string,
): CalendarDay[] {
  const span = daysBetween(start, end);
  if (span < 0) throw new Error("End date must be on or after the start date.");
  if (span > MAX_RANGE_DAYS) throw new Error("Date range cannot exceed two years.");

  const holidayIndex = buildHolidayIndex(dataset, countryCodes);
  return Array.from({ length: span + 1 }, (_, index) => {
    const date = shiftDate(start, index);
    const weekday = parseDate(date).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const conflicts = holidayIndex.get(date) ?? [];
    return {
      date,
      weekday,
      weekend,
      conflicts,
      isSharedBusinessDay: !weekend && conflicts.length === 0,
    };
  });
}

export function summarizeDays(days: CalendarDay[]) {
  const weekdays = days.filter((day) => !day.weekend);
  const shared = days.filter((day) => day.isSharedBusinessDay);
  const blockedWeekdays = weekdays.filter((day) => day.conflicts.length > 0);

  return {
    calendarDays: days.length,
    weekdays: weekdays.length,
    sharedBusinessDays: shared.length,
    blockedWeekdays: blockedWeekdays.length,
    availabilityRate: weekdays.length
      ? Math.round((shared.length / weekdays.length) * 100)
      : 0,
  };
}

export function addSharedBusinessDays(
  dataset: HolidayDataset,
  countryCodes: string[],
  start: string,
  amount: number,
): { result: string; examined: CalendarDay[] } {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    throw new Error("Business days must be a non-zero integer between -500 and 500.");
  }

  const direction = amount > 0 ? 1 : -1;
  const target = Math.abs(amount);
  const holidayIndex = buildHolidayIndex(dataset, countryCodes);
  const examined: CalendarDay[] = [];
  let cursor = start;
  let counted = 0;

  while (counted < target) {
    cursor = shiftDate(cursor, direction);
    const weekday = parseDate(cursor).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const conflicts = holidayIndex.get(cursor) ?? [];
    const day = {
      date: cursor,
      weekday,
      weekend,
      conflicts,
      isSharedBusinessDay: !weekend && conflicts.length === 0,
    };
    examined.push(day);
    if (day.isSharedBusinessDay) counted += 1;
    if (examined.length > 1_000) throw new Error("Unable to resolve the requested date.");
  }

  return { result: cursor, examined };
}

export function findSharedWindows(
  dataset: HolidayDataset,
  countryCodes: string[],
  start: string,
  horizonDays: number,
  businessDays: number,
): SharedWindow[] {
  if (horizonDays < 7 || horizonDays > 365) {
    throw new Error("Search horizon must be between 7 and 365 days.");
  }
  if (businessDays < 1 || businessDays > 20) {
    throw new Error("Window length must be between 1 and 20 business days.");
  }

  const end = shiftDate(start, horizonDays - 1);
  const days = analyzeRange(dataset, countryCodes, start, end);
  const sharedDays = days.filter((day) => day.isSharedBusinessDay);
  const windows: SharedWindow[] = [];

  for (let index = 0; index <= sharedDays.length - businessDays; index += 1) {
    const slice = sharedDays.slice(index, index + businessDays);
    const first = slice[0];
    const last = slice.at(-1);
    if (!first || !last) continue;
    const between = days.filter((day) => day.date >= first.date && day.date <= last.date);
    const interrupted = between.some((day) => !day.weekend && !day.isSharedBusinessDay);
    if (interrupted) continue;

    windows.push({
      start: first.date,
      end: last.date,
      businessDays,
      calendarDays: daysBetween(first.date, last.date) + 1,
    });
    if (windows.length === 5) break;
  }

  return windows;
}

export function formatHumanDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(parseDate(value));
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function startOfMonth(value: string): string {
  return `${monthKey(value)}-01`;
}

export function endOfMonth(value: string): string {
  const [year, month] = monthKey(value).split("-").map(Number);
  return formatDate(new Date(Date.UTC(year, month, 0)));
}
