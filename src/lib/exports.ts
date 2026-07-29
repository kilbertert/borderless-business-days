import type { CalendarDay } from "./types";

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function daysToCsv(days: CalendarDay[]): string {
  const rows = ["date,status,affected_countries,holidays"];
  for (const day of days) {
    const status = day.weekend
      ? "weekend"
      : day.isSharedBusinessDay
        ? "shared_business_day"
        : "holiday_conflict";
    rows.push(
      [
        day.date,
        status,
        escapeCsv([...new Set(day.conflicts.map((item) => item.countryCode))].join("|")),
        escapeCsv(day.conflicts.map((item) => `${item.countryName}: ${item.name}`).join(" | ")),
      ].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}

function escapeIcs(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function compactDate(value: string): string {
  return value.replaceAll("-", "");
}

export function daysToIcs(days: CalendarDay[]): string {
  const events = days.flatMap((day) =>
    day.conflicts.map((conflict, index) =>
      [
        "BEGIN:VEVENT",
        `UID:${day.date}-${conflict.countryCode}-${index}@borderless-business-days`,
        `DTSTAMP:${compactDate(new Date().toISOString().slice(0, 10))}T000000Z`,
        `DTSTART;VALUE=DATE:${compactDate(day.date)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDate(day.date))}`,
        `SUMMARY:${escapeIcs(`${conflict.countryCode} - ${conflict.name}`)}`,
        `DESCRIPTION:${escapeIcs(`Public holiday in ${conflict.countryName}. Source: date-holidays.`)}`,
        "END:VEVENT",
      ].join("\r\n"),
    ),
  );

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Borderless Business Days//EN", ...events, "END:VCALENDAR", ""].join("\r\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
