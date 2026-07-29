export type Holiday = {
  date: string;
  name: string;
  type: "public";
};

export type CountryData = {
  code: string;
  name: string;
  holidays: Record<string, Holiday[]>;
};

export type HolidayDataset = {
  generatedAt: string;
  years: number[];
  attribution: {
    name: string;
    url: string;
    license: string;
  };
  countries: CountryData[];
};

export type HolidayConflict = Holiday & {
  countryCode: string;
  countryName: string;
};

export type CalendarDay = {
  date: string;
  weekday: number;
  weekend: boolean;
  conflicts: HolidayConflict[];
  isSharedBusinessDay: boolean;
};

export type SharedWindow = {
  start: string;
  end: string;
  businessDays: number;
  calendarDays: number;
};
