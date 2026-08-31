import { describe, expect, it } from "vitest";
import { FAMILY_MEMBER_COLORS } from "@/lib/familyMemberColors";
import { FAMILY_MEMBER_AVATARS } from "@/lib/familyMemberAvatars";
import {
  familySetupSchema,
  familyGroupUpdateSchema,
  familyMemberCreateSchema,
  calendarEventCreateSchema,
  calendarEventRangeQuerySchema,
  choreCreateSchema,
  routineCreateSchema,
  todoCreateSchema,
  todoUpdateSchema,
} from "@/lib/schemas";

const VALID_COLOR = FAMILY_MEMBER_COLORS[0].key;
const VALID_AVATAR = FAMILY_MEMBER_AVATARS[0].key;

describe("familySetupSchema", () => {
  it("accepts 'create' mode with a non-empty name", () => {
    const result = familySetupSchema.safeParse({ mode: "create", familyGroupName: "Greenwood" });
    expect(result.success).toBe(true);
  });

  it("rejects 'create' mode with a blank name", () => {
    const result = familySetupSchema.safeParse({ mode: "create", familyGroupName: "   " });
    expect(result.success).toBe(false);
  });

  it("trims and uppercases the invite code for 'join' mode", () => {
    const result = familySetupSchema.safeParse({ mode: "join", inviteCode: " k7p4-x92l " });
    expect(result.success).toBe(true);
    if (result.success && result.data.mode === "join") {
      expect(result.data.inviteCode).toBe("K7P4-X92L");
    }
  });

  it("rejects 'join' mode with a blank code", () => {
    const result = familySetupSchema.safeParse({ mode: "join", inviteCode: "   " });
    expect(result.success).toBe(false);
  });
});

describe("familyGroupUpdateSchema", () => {
  it("accepts a partial update with just holidayMode", () => {
    expect(familyGroupUpdateSchema.safeParse({ holidayMode: true }).success).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(familyGroupUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("familyMemberCreateSchema", () => {
  it("accepts a valid child with a known color", () => {
    const result = familyMemberCreateSchema.safeParse({
      name: "Jack",
      color: VALID_COLOR,
      avatar: VALID_AVATAR,
    });
    expect(result.success).toBe(true);
  });

  it("collapses internal whitespace in the name", () => {
    const result = familyMemberCreateSchema.safeParse({
      name: "  Jack   Greenwood  ",
      color: VALID_COLOR,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Jack Greenwood");
  });

  it("rejects an unknown color key", () => {
    const result = familyMemberCreateSchema.safeParse({ name: "Jack", color: "not-a-real-color" });
    expect(result.success).toBe(false);
  });
});

describe("calendarEventCreateSchema", () => {
  const base = { title: "Football", participantIds: [1, 2] };

  it("accepts a valid timed event where end is after start", () => {
    const result = calendarEventCreateSchema.safeParse({
      ...base,
      allDay: false,
      startAt: "2026-01-05T18:00:00.000Z",
      endAt: "2026-01-05T19:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a timed event where end is not after start", () => {
    const result = calendarEventCreateSchema.safeParse({
      ...base,
      allDay: false,
      startAt: "2026-01-05T19:00:00.000Z",
      endAt: "2026-01-05T18:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid all-day event where endDate is on/after startDate", () => {
    const result = calendarEventCreateSchema.safeParse({
      ...base,
      allDay: true,
      startDate: "2026-01-05",
      endDate: "2026-01-05",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an all-day event where endDate is before startDate", () => {
    const result = calendarEventCreateSchema.safeParse({
      ...base,
      allDay: true,
      startDate: "2026-01-05",
      endDate: "2026-01-04",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an event with no participants", () => {
    const result = calendarEventCreateSchema.safeParse({
      title: "Football",
      participantIds: [],
      allDay: true,
      startDate: "2026-01-05",
      endDate: "2026-01-05",
    });
    expect(result.success).toBe(false);
  });
});

describe("calendarEventRangeQuerySchema", () => {
  it("accepts a short valid range", () => {
    const result = calendarEventRangeQuerySchema.safeParse({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-08T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a range where end is not after start", () => {
    const result = calendarEventRangeQuerySchema.safeParse({
      start: "2026-01-08T00:00:00.000Z",
      end: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a range longer than 62 days", () => {
    const result = calendarEventRangeQuerySchema.safeParse({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-06-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("choreCreateSchema", () => {
  const base = { title: "Empty dishwasher", familyMemberId: 1 };

  it("accepts valid weekday selection", () => {
    expect(choreCreateSchema.safeParse({ ...base, daysOfWeek: [1, 2, 3, 4, 5] }).success).toBe(
      true
    );
  });

  it("rejects an empty daysOfWeek", () => {
    expect(choreCreateSchema.safeParse({ ...base, daysOfWeek: [] }).success).toBe(false);
  });

  it("rejects an out-of-range day value", () => {
    expect(choreCreateSchema.safeParse({ ...base, daysOfWeek: [7] }).success).toBe(false);
  });
});

describe("routineCreateSchema", () => {
  const base = {
    name: "Morning",
    period: "MORNING" as const,
    familyMemberId: 1,
    daysOfWeek: [1, 2, 3, 4, 5],
  };

  it("accepts a valid routine with at least one item", () => {
    const result = routineCreateSchema.safeParse({ ...base, items: ["Get dressed"] });
    expect(result.success).toBe(true);
  });

  it("rejects a routine with no items", () => {
    const result = routineCreateSchema.safeParse({ ...base, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid period", () => {
    const result = routineCreateSchema.safeParse({
      ...base,
      period: "NIGHT",
      items: ["Get dressed"],
    });
    expect(result.success).toBe(false);
  });
});

describe("todoCreateSchema / todoUpdateSchema", () => {
  it("accepts a valid todo", () => {
    expect(todoCreateSchema.safeParse({ text: "Buy milk", userId: 1 }).success).toBe(true);
  });

  it("rejects a todo with blank text", () => {
    expect(todoCreateSchema.safeParse({ text: "  ", userId: 1 }).success).toBe(false);
  });

  it("rejects an update with no fields set", () => {
    expect(todoUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an update that only flips priority", () => {
    expect(todoUpdateSchema.safeParse({ priority: true }).success).toBe(true);
  });
});
