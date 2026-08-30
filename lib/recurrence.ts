import { DateTime } from "luxon";

/**
 * Simple recurrence presets (DesignSpec.md §10.5/§36) -- not a full RRULE builder.
 * The stored `rrule` string is still a genuine RFC5545 fragment so it stays
 * standards-compatible, but expansion below is hand-rolled with Luxon so
 * "same weekday every week" / "same date every month" stay correct across DST
 * transitions in the family's timezone, which a UTC-floating RRULE library
 * wouldn't give for free.
 */
export type RecurrencePreset = "none" | "daily" | "weekly" | "monthly";

const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function buildRRule(
  preset: RecurrencePreset,
  startAt: Date,
  timezone: string,
  recurrenceEndDate: Date | null
): string | null {
  if (preset === "none") return null;

  const dt = DateTime.fromJSDate(startAt, { zone: timezone });
  const parts = [`FREQ=${preset.toUpperCase()}`];

  if (preset === "weekly") {
    parts.push(`BYDAY=${WEEKDAY_CODES[dt.weekday - 1]}`);
  }
  if (preset === "monthly") {
    parts.push(`BYMONTHDAY=${dt.day}`);
  }
  if (recurrenceEndDate) {
    const until = DateTime.fromJSDate(recurrenceEndDate, { zone: timezone })
      .endOf("day")
      .toUTC();
    parts.push(`UNTIL=${until.toFormat("yyyyLLdd'T'HHmmss'Z'")}`);
  }

  return parts.join(";");
}

export function parseRecurrencePreset(rrule: string | null): RecurrencePreset {
  if (!rrule) return "none";
  if (rrule.includes("FREQ=DAILY")) return "daily";
  if (rrule.includes("FREQ=WEEKLY")) return "weekly";
  if (rrule.includes("FREQ=MONTHLY")) return "monthly";
  return "none";
}

export function getRecurrenceUntil(rrule: string | null): Date | null {
  const match = rrule?.match(/UNTIL=(\d{8}T\d{6}Z)/);
  if (!match) return null;
  const parsed = DateTime.fromFormat(match[1], "yyyyLLdd'T'HHmmss'Z'", { zone: "utc" });
  return parsed.isValid ? parsed.toJSDate() : null;
}

export type Occurrence = { startAt: Date; endAt: Date };

const MAX_OCCURRENCES = 366;

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

export function expandOccurrences(
  event: { startAt: Date; endAt: Date; rrule: string | null },
  rangeStart: Date,
  rangeEnd: Date,
  timezone: string
): Occurrence[] {
  const durationMs = event.endAt.getTime() - event.startAt.getTime();

  if (!event.rrule) {
    return overlaps(event.startAt, event.endAt, rangeStart, rangeEnd)
      ? [{ startAt: event.startAt, endAt: event.endAt }]
      : [];
  }

  const preset = parseRecurrencePreset(event.rrule);
  if (preset === "none") {
    return overlaps(event.startAt, event.endAt, rangeStart, rangeEnd)
      ? [{ startAt: event.startAt, endAt: event.endAt }]
      : [];
  }

  const until = getRecurrenceUntil(event.rrule);
  const unit: "days" | "weeks" | "months" =
    preset === "daily" ? "days" : preset === "weekly" ? "weeks" : "months";

  let cursor = DateTime.fromJSDate(event.startAt, { zone: timezone });
  const rangeStartDt = DateTime.fromJSDate(rangeStart, { zone: timezone });
  const rangeEndDt = DateTime.fromJSDate(rangeEnd, { zone: timezone });
  const untilDt = until ? DateTime.fromJSDate(until, { zone: timezone }) : null;

  // Fast-forward close to the range so long-running recurring events don't
  // replay every past occurrence.
  if (cursor < rangeStartDt) {
    const diff = rangeStartDt.diff(cursor, unit).get(unit);
    const steps = Math.max(0, Math.floor(diff) - 1);
    if (steps > 0) cursor = cursor.plus({ [unit]: steps });
  }

  const occurrences: Occurrence[] = [];
  for (let i = 0; i < MAX_OCCURRENCES && cursor <= rangeEndDt; i++) {
    if (untilDt && cursor > untilDt) break;

    const occStart = cursor.toJSDate();
    const occEnd = new Date(occStart.getTime() + durationMs);
    if (occStart >= event.startAt && overlaps(occStart, occEnd, rangeStart, rangeEnd)) {
      occurrences.push({ startAt: occStart, endAt: occEnd });
    }
    cursor = cursor.plus({ [unit]: 1 });
  }

  return occurrences;
}
