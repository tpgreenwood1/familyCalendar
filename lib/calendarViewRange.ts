export type CalendarView = "day" | "multiday" | "week";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Column count for multi-day view -- §10.4 targets 3-5 depending on width. */
export function multiDayColumnCount(viewportWidth: number): number {
  return viewportWidth >= 1280 ? 5 : 3;
}

export function getViewRange(
  view: CalendarView,
  anchorDate: Date,
  multiDayCount: number
): { start: Date; end: Date } {
  if (view === "week") {
    const start = startOfWeek(anchorDate);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfDay(anchorDate);
  const days = view === "day" ? 1 : multiDayCount;
  return { start, end: addDays(start, days) };
}

export function shiftAnchor(view: CalendarView, anchorDate: Date, multiDayCount: number, direction: 1 | -1): Date {
  const days = view === "week" ? 7 : view === "day" ? 1 : multiDayCount;
  return addDays(anchorDate, days * direction);
}
