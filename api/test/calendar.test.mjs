import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { addSharedBusinessDays, analyzeRange, findSharedWindows, loadDataset, summarizeDays, validateCountries } from "../calendar.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataset = loadDataset(path.resolve(testDirectory, "../../src/data/holidays.json"));

test("analyzes shared business days and holiday conflicts", () => {
  const countries = validateCountries(dataset, ["us", "GB"]);
  const days = analyzeRange(dataset, countries, "2026-01-01", "2026-01-05");
  assert.deepEqual(summarizeDays(days), {
    calendarDays: 5,
    weekdays: 3,
    sharedBusinessDays: 2,
    blockedWeekdays: 1,
    availabilityRate: 67,
  });
  assert.equal(days[0].conflicts.some((conflict) => conflict.countryCode === "US"), true);
  assert.equal(days[0].conflicts.some((conflict) => conflict.countryCode === "GB"), true);
});

test("adds shared business days after a holiday", () => {
  const result = addSharedBusinessDays(dataset, ["US"], "2026-01-01", 1);
  assert.equal(result.result, "2026-01-02");
  assert.equal(result.examined.length, 1);
});

test("reports an unresolved date when an offset leaves the dataset", () => {
  const maximumYear = dataset.years.at(-1);
  assert.throws(() => addSharedBusinessDays(dataset, ["US"], `${maximumYear}-12-31`, 1), /Unable to resolve the requested date/);
});

test("finds uninterrupted shared business-day windows", () => {
  const result = findSharedWindows(dataset, ["US", "GB"], "2026-01-01", 30, 3);
  assert.equal(result.windows.length > 0, true);
  assert.equal(result.windows[0].businessDays, 3);
});

test("rejects invalid markets and normalized calendar dates", () => {
  assert.throws(() => validateCountries(dataset, ["US", "US"]), /unique/);
  assert.throws(() => analyzeRange(dataset, ["US"], "2026-02-30", "2026-03-03"), /Invalid date/);
});

test("rejects incomplete or malformed holiday datasets", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bbd-dataset-"));
  const datasetPath = path.join(directory, "holidays.json");
  const base = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    years: [2026],
    attribution: { name: "date-holidays", url: "https://example.test", license: "ISC" },
    countries: [{ code: "US", name: "United States", holidays: { 2026: [] } }],
  };

  try {
    for (const invalid of [
      { ...base, years: [] },
      { ...base, countries: [{ code: "US", name: "United States", holidays: {} }] },
      { ...base, countries: [{ code: "US", name: "United States", holidays: { 2026: [{ name: "Bad date", date: "2026-02-30" }] } }] },
    ]) {
      writeFileSync(datasetPath, JSON.stringify(invalid), "utf8");
      assert.throws(() => loadDataset(datasetPath), /Holiday dataset is invalid/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
