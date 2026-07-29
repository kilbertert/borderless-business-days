import { formatDate, formatHumanDate, parseDate, shiftDate, startOfMonth } from "@/lib/calendar";
import type { CalendarDay } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  month: string;
  statusByDate: Map<string, CalendarDay>;
};

export function MonthGrid({ month, statusByDate }: Props) {
  const first = startOfMonth(month);
  const mondayOffset = (parseDate(first).getUTCDay() + 6) % 7;
  const firstCell = shiftDate(first, -mondayOffset);
  const cells = Array.from({ length: 42 }, (_, index) => shiftDate(firstCell, index));
  const currentMonth = first.slice(0, 7);

  return (
    <section className="month-grid" aria-label={formatHumanDate(first, { month: "long", year: "numeric" })}>
      <h3>{formatHumanDate(first, { month: "long", year: "numeric" })}</h3>
      <div className="weekday-row" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-cells">
        {cells.map((date) => {
          const status = statusByDate.get(date);
          const outside = date.slice(0, 7) !== currentMonth;
          const weekday = parseDate(date).getUTCDay();
          const inferredWeekend = weekday === 0 || weekday === 6;
          const classNames = ["calendar-day"];
          if (outside) classNames.push("outside");
          if (status?.conflicts.length) classNames.push("conflict");
          else if (status?.isSharedBusinessDay) classNames.push("shared");
          else if (status?.weekend || inferredWeekend) classNames.push("weekend");
          const title = status?.conflicts.length
            ? status.conflicts.map((item) => `${item.countryCode}: ${item.name}`).join("; ")
            : status?.isSharedBusinessDay
              ? "Shared business day"
              : "Weekend or outside selected range";
          return (
            <span className={classNames.join(" ")} title={title} key={date}>
              {Number(formatDate(parseDate(date)).slice(-2))}
            </span>
          );
        })}
      </div>
    </section>
  );
}
