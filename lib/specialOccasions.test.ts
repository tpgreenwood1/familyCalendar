import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { computeOccasionFields, sortByNextOccurrence, type SpecialOccasionDTO } from "@/lib/specialOccasions";

describe("computeOccasionFields", () => {
  it("computes daysUntil and computedYears for a date later this year", () => {
    const today = DateTime.fromISO("2026-01-01", { zone: "UTC" });
    const originalDate = new Date("1978-04-12T00:00:00.000Z");

    const result = computeOccasionFields(originalDate, today);

    expect(result.daysUntil).toBe(101);
    expect(result.isToday).toBe(false);
    expect(result.computedYears).toBe(48);
    expect(result.nextOccurrenceDate.toISODate()).toBe("2026-04-12");
  });

  it("rolls over to next year when this year's date has already passed", () => {
    const today = DateTime.fromISO("2026-08-31", { zone: "UTC" });
    const originalDate = new Date("1990-04-12T00:00:00.000Z");

    const result = computeOccasionFields(originalDate, today);

    expect(result.nextOccurrenceDate.toISODate()).toBe("2027-04-12");
    expect(result.computedYears).toBe(37);
    expect(result.isToday).toBe(false);
  });

  it("returns daysUntil 0 and isToday true when today matches", () => {
    const today = DateTime.fromISO("2026-08-31", { zone: "UTC" });
    const originalDate = new Date("2000-08-31T00:00:00.000Z");

    const result = computeOccasionFields(originalDate, today);

    expect(result.daysUntil).toBe(0);
    expect(result.isToday).toBe(true);
    expect(result.computedYears).toBe(26);
  });

  it("observes a Feb 29 birth date on Feb 28 in a non-leap candidate year", () => {
    const today = DateTime.fromISO("2026-01-01", { zone: "UTC" }); // 2026 is not a leap year
    const originalDate = new Date("2000-02-29T00:00:00.000Z");

    const result = computeOccasionFields(originalDate, today);

    expect(result.nextOccurrenceDate.toISODate()).toBe("2026-02-28");
  });

  it("observes a Feb 29 birth date on Feb 29 itself in a leap candidate year", () => {
    const today = DateTime.fromISO("2027-06-01", { zone: "UTC" }); // next Feb is 2028, a leap year
    const originalDate = new Date("2000-02-29T00:00:00.000Z");

    const result = computeOccasionFields(originalDate, today);

    expect(result.nextOccurrenceDate.toISODate()).toBe("2028-02-29");
  });
});

describe("sortByNextOccurrence", () => {
  function makeOccasion(overrides: Partial<SpecialOccasionDTO>): SpecialOccasionDTO {
    return {
      id: 1,
      title: "Occasion",
      type: "BIRTHDAY",
      originalDate: new Date("2000-01-01T00:00:00.000Z"),
      isSomber: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextOccurrenceDate: new Date(),
      daysUntil: 0,
      isToday: true,
      computedYears: 0,
      ...overrides,
    };
  }

  it("sorts ascending by daysUntil", () => {
    const occasions = [
      makeOccasion({ id: 1, title: "B", daysUntil: 10 }),
      makeOccasion({ id: 2, title: "A", daysUntil: 2 }),
      makeOccasion({ id: 3, title: "C", daysUntil: 5 }),
    ];

    const sorted = sortByNextOccurrence(occasions);

    expect(sorted.map((o) => o.id)).toEqual([2, 3, 1]);
  });

  it("breaks ties alphabetically by title", () => {
    const occasions = [
      makeOccasion({ id: 1, title: "Zebra", daysUntil: 3 }),
      makeOccasion({ id: 2, title: "Apple", daysUntil: 3 }),
    ];

    const sorted = sortByNextOccurrence(occasions);

    expect(sorted.map((o) => o.title)).toEqual(["Apple", "Zebra"]);
  });
});
