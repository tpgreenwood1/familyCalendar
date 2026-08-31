import { describe, expect, it } from "vitest";
import {
  buildRRule,
  parseRecurrencePreset,
  getRecurrenceUntil,
  expandOccurrences,
} from "@/lib/recurrence";

describe("buildRRule", () => {
  it("returns null for preset 'none'", () => {
    expect(buildRRule("none", new Date("2026-01-05T09:00:00.000Z"), "UTC", null)).toBeNull();
  });

  it("builds a daily rule with no BYDAY/BYMONTHDAY", () => {
    expect(buildRRule("daily", new Date("2026-01-05T09:00:00.000Z"), "UTC", null)).toBe(
      "FREQ=DAILY"
    );
  });

  it("builds a weekly rule with BYDAY matching the start weekday", () => {
    // 2026-01-05 is a Monday.
    expect(buildRRule("weekly", new Date("2026-01-05T09:00:00.000Z"), "UTC", null)).toBe(
      "FREQ=WEEKLY;BYDAY=MO"
    );
  });

  it("builds a monthly rule with BYMONTHDAY matching the start day", () => {
    expect(buildRRule("monthly", new Date("2026-01-05T09:00:00.000Z"), "UTC", null)).toBe(
      "FREQ=MONTHLY;BYMONTHDAY=5"
    );
  });

  it("appends UNTIL as the end of the recurrence-end day, in UTC", () => {
    const rrule = buildRRule(
      "daily",
      new Date("2026-01-05T09:00:00.000Z"),
      "UTC",
      new Date("2026-01-31T00:00:00.000Z")
    );
    expect(rrule).toBe("FREQ=DAILY;UNTIL=20260131T235959Z");
  });
});

describe("parseRecurrencePreset", () => {
  it("returns 'none' for null", () => {
    expect(parseRecurrencePreset(null)).toBe("none");
  });

  it.each([
    ["FREQ=DAILY", "daily"],
    ["FREQ=WEEKLY;BYDAY=MO", "weekly"],
    ["FREQ=MONTHLY;BYMONTHDAY=5", "monthly"],
    ["FREQ=YEARLY", "none"],
    ["garbage", "none"],
  ] as const)("parses %s as %s", (rrule, expected) => {
    expect(parseRecurrencePreset(rrule)).toBe(expected);
  });
});

describe("getRecurrenceUntil", () => {
  it("returns null when there is no UNTIL clause", () => {
    expect(getRecurrenceUntil("FREQ=DAILY")).toBeNull();
    expect(getRecurrenceUntil(null)).toBeNull();
  });

  it("parses a valid UNTIL clause back into a Date", () => {
    const until = getRecurrenceUntil("FREQ=DAILY;UNTIL=20260131T235959Z");
    expect(until).toEqual(new Date("2026-01-31T23:59:59.000Z"));
  });

  it("returns null for a malformed UNTIL value", () => {
    expect(getRecurrenceUntil("FREQ=DAILY;UNTIL=not-a-date")).toBeNull();
  });
});

describe("expandOccurrences", () => {
  it("returns the single occurrence when a non-recurring event overlaps the range", () => {
    const event = {
      startAt: new Date("2026-01-05T09:00:00.000Z"),
      endAt: new Date("2026-01-05T10:00:00.000Z"),
      rrule: null,
    };
    const result = expandOccurrences(
      event,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-10T00:00:00.000Z"),
      "UTC"
    );
    expect(result).toEqual([{ startAt: event.startAt, endAt: event.endAt }]);
  });

  it("returns nothing for a non-recurring event outside the range", () => {
    const event = {
      startAt: new Date("2026-01-05T09:00:00.000Z"),
      endAt: new Date("2026-01-05T10:00:00.000Z"),
      rrule: null,
    };
    const result = expandOccurrences(
      event,
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-02-10T00:00:00.000Z"),
      "UTC"
    );
    expect(result).toEqual([]);
  });

  it("expands a daily recurring event to one occurrence per day in range", () => {
    const event = {
      startAt: new Date("2026-01-05T09:00:00.000Z"),
      endAt: new Date("2026-01-05T10:00:00.000Z"),
      rrule: "FREQ=DAILY",
    };
    const result = expandOccurrences(
      event,
      new Date("2026-01-05T00:00:00.000Z"),
      new Date("2026-01-08T00:00:00.000Z"),
      "UTC"
    );
    expect(result.map((o) => o.startAt.toISOString())).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-06T09:00:00.000Z",
      "2026-01-07T09:00:00.000Z",
    ]);
  });

  it("never returns an occurrence before the event's own start date", () => {
    const event = {
      startAt: new Date("2026-01-05T09:00:00.000Z"),
      endAt: new Date("2026-01-05T10:00:00.000Z"),
      rrule: "FREQ=DAILY",
    };
    const result = expandOccurrences(
      event,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-06T00:00:00.000Z"),
      "UTC"
    );
    expect(result.every((o) => o.startAt >= event.startAt)).toBe(true);
    expect(result[0].startAt.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });

  it("respects the UNTIL bound and produces no occurrences past it", () => {
    const event = {
      startAt: new Date("2026-01-05T09:00:00.000Z"),
      endAt: new Date("2026-01-05T10:00:00.000Z"),
      rrule: "FREQ=DAILY;UNTIL=20260106T235959Z",
    };
    const result = expandOccurrences(
      event,
      new Date("2026-01-05T00:00:00.000Z"),
      new Date("2026-01-10T00:00:00.000Z"),
      "UTC"
    );
    expect(result.map((o) => o.startAt.toISOString())).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-06T09:00:00.000Z",
    ]);
  });

  it("preserves local wall-clock time across a DST transition (Europe/London)", () => {
    // 2026-03-29 is when UK clocks spring forward (last Sunday of March).
    // A weekly 09:00 local event should stay at 09:00 local time throughout,
    // which means its UTC instant shifts from 09:00Z to 08:00Z once BST begins.
    const event = {
      startAt: new Date("2026-03-01T09:00:00.000Z"), // 09:00 GMT (pre-DST)
      endAt: new Date("2026-03-01T10:00:00.000Z"),
      rrule: "FREQ=WEEKLY;BYDAY=SU",
    };
    const result = expandOccurrences(
      event,
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-04-06T00:00:00.000Z"),
      "Europe/London"
    );

    // Every occurrence is 09:00 local London time, DST or not.
    for (const occ of result) {
      expect(occ.startAt.getUTCHours() === 9 || occ.startAt.getUTCHours() === 8).toBe(true);
    }

    const utcHours = result.map((o) => o.startAt.getUTCHours());
    // Pre-transition Sundays (Mar 1, 8, 15, 22) are still GMT (UTC+0).
    expect(utcHours.slice(0, 4)).toEqual([9, 9, 9, 9]);
    // Mar 29 onward is BST (UTC+1), so the same local 09:00 is 08:00 UTC.
    expect(utcHours.slice(4)).toEqual([8, 8]);
  });

  it("caps the number of generated occurrences at 366", () => {
    const event = {
      startAt: new Date("2025-01-01T00:00:00.000Z"),
      endAt: new Date("2025-01-01T01:00:00.000Z"),
      rrule: "FREQ=DAILY",
    };
    const result = expandOccurrences(
      event,
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2028-01-01T00:00:00.000Z"), // far more than 366 days of range
      "UTC"
    );
    expect(result.length).toBe(366);
  });

  it("fast-forwards close to the range instead of replaying every past occurrence", () => {
    const event = {
      startAt: new Date("2020-01-01T00:00:00.000Z"),
      endAt: new Date("2020-01-01T01:00:00.000Z"),
      rrule: "FREQ=DAILY",
    };
    const rangeStart = new Date("2026-01-01T00:00:00.000Z");
    const rangeEnd = new Date("2026-01-05T00:00:00.000Z");
    const result = expandOccurrences(event, rangeStart, rangeEnd, "UTC");

    // Only a handful of occurrences near the requested range, not ~2192 days'
    // worth replayed from the original 2020 start date.
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    for (const occ of result) {
      expect(occ.startAt.getTime()).toBeLessThan(rangeEnd.getTime());
      expect(occ.startAt.getTime()).toBeGreaterThanOrEqual(
        rangeStart.getTime() - 2 * 24 * 60 * 60 * 1000
      );
    }
  });
});
