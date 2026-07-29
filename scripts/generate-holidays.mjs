import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Holidays from "date-holidays";

const generatedDay = process.env.HOLIDAY_DATA_DATE ?? new Date().toISOString().slice(0, 10);
const generatedAt = `${generatedDay}T00:00:00.000Z`;
const sourceDate = new Date(generatedAt);
const firstYear = sourceDate.getUTCFullYear() - 1;
const years = Array.from({ length: 5 }, (_, index) => firstYear + index);
const outputPath = resolve("src/data/holidays.json");
const catalog = new Holidays();
const countryNames = catalog.getCountries("en");

const countries = Object.entries(countryNames)
  .sort(([, left], [, right]) => left.localeCompare(right))
  .flatMap(([code, name]) => {
    try {
      const calendar = new Holidays(code);
      calendar.setLanguages("en");
      const holidays = Object.fromEntries(
        years.map((year) => {
          const seen = new Set();
          const publicHolidays = calendar
            .getHolidays(year)
            .filter((holiday) => holiday.type === "public")
            .map((holiday) => ({
              date: holiday.date.slice(0, 10),
              name: holiday.name,
              type: holiday.type,
            }))
            .filter((holiday) => {
              const key = `${holiday.date}:${holiday.name}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          return [String(year), publicHolidays];
        }),
      );

      return [{ code, name, holidays }];
    } catch (error) {
      console.warn(`Skipping ${code}: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  });

const dataset = {
  generatedAt,
  years,
  attribution: {
    name: "date-holidays",
    url: "https://github.com/commenthol/date-holidays",
    license: "ISC AND CC-BY-3.0",
  },
  countries,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(dataset)}\n`, "utf8");
console.log(`Generated ${countries.length} countries for ${years.join(", ")}`);
