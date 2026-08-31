import { describe, expect, it } from "vitest";
import { can, requireCan, type Action, type FamilyContext } from "@/lib/authz";

// Every currently-defined Action. There is no ADULT/CHILD role split yet (see the
// doc comment on `can` in lib/authz.ts) -- every action is allowed for any
// authenticated member of the family. These tests document that baseline so a
// future role split shows up as an intentional, visible test change rather than
// a silent behavior shift.
const ALL_ACTIONS: Action[] = [
  "family.update",
  "familyMember.manage",
  "todo.manage",
  "invitation.create",
  "calendarEvent.manage",
  "chore.manage",
  "choreOccurrence.manage",
  "routine.manage",
  "routineOccurrence.manage",
  "shoppingItem.manage",
];

const context: FamilyContext = {
  user: { id: "user-1", email: "a@example.com", name: "Adult" },
  familyGroupId: 1,
};

describe("can", () => {
  it.each(ALL_ACTIONS)("allows %s for any authenticated family member", (action) => {
    expect(can(context, action)).toBe(true);
  });
});

describe("requireCan", () => {
  it.each(ALL_ACTIONS)("does not throw for %s", (action) => {
    expect(() => requireCan(context, action)).not.toThrow();
  });
});
