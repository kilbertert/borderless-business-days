import { describe, expect, it } from "vitest";
import { addSharedBusinessDays, analyzeRange, findSharedWindows, summarizeDays } from "./calendar";
import type { HolidayDataset } from "./types";

const dataset: HolidayDataset = {
  generatedAt: "2026-07-29T00:00:00.000Z",
  years: [2026],
  attribution: { name: "test", url: "https://example.com", license: "test" },
  countries: [
    {
      code: "US",
      name: "United States",
      holidays: { "2026": [{ date: "2026-01-01", name: "New Year", type: "public" }] },
    },
    {
      code: "GB",
      name: "United Kingdom",
      holidays: { "2026": [{ date: "2026-01-02", name: "Test Holiday", type: "public" }] },
    },
  ],
};

describe("cross-border calendar", () => {
  it("excludes weekends and holidays from shared business days", () => {
    const days = analyzeRange(dataset, ["US", "GB"], "2026-01-01", "2026-01-07");
    expect(summarizeDays(days)).toMatchObject({
      calendarDays: 7,
      weekdays: 5,
      sharedBusinessDays: 3,
      blockedWeekdays: 2,
      availabilityRate: 60,
    });
  });

  it("adds shared business days across both holiday calendars", () => {
    const result = addSharedBusinessDays(dataset, ["US", "GB"], "2025-12-31", 2);
    expect(result.result).toBe("2026-01-06");
  });

  it("finds the earliest uninterrupted shared window", () => {
    const windows = findSharedWindows(dataset, ["US", "GB"], "2026-01-01", 14, 3);
    expect(windows[0]).toMatchObject({
      start: "2026-01-05",
      end: "2026-01-07",
      businessDays: 3,
    });
  });
});
