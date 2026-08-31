import { z } from "zod";
import { FAMILY_MEMBER_COLORS } from "@/lib/familyMemberColors";
import { FAMILY_MEMBER_AVATARS } from "@/lib/familyMemberAvatars";

function trimmedString(message: string) {
  return z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, message));
}

// Account creation itself (email/password/name) is validated by Better Auth's own
// sign-up endpoint. This schema only covers the follow-up step of attaching that
// account to a family — see app/api/family/setup/route.ts.
export const familySetupSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    familyGroupName: trimmedString("Family name is required"),
  }),
  z.object({
    mode: z.literal("join"),
    inviteCode: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .pipe(z.string().min(1, "Invalid invite code")),
  }),
]);

export const familyGroupUpdateSchema = z
  .object({
    name: trimmedString("name is required").optional(),
    holidayMode: z.boolean().optional(),
    screensaverEnabled: z.boolean().optional(),
    // null clears the selection (screensaver auto-disables -- see lib/photos.ts).
    screensaverAlbumId: z.number().int().nullable().optional(),
    screensaverIntervalSeconds: z.number().int().min(3).max(300).optional(),
    screensaverIdleSeconds: z.number().int().min(30).max(3600).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "no changes provided",
  });

const familyMemberColor = z.enum(
  FAMILY_MEMBER_COLORS.map((c) => c.key) as [string, ...string[]],
  { message: "color is required" }
);

const familyMemberAvatar = z.enum(
  FAMILY_MEMBER_AVATARS.map((a) => a.key) as [string, ...string[]],
  { message: "invalid avatar" }
);

// Plain YYYY-MM-DD, not a full timestamp -- date of birth has no meaningful time component.
const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .nullable();

// Creation always makes a CHILD (DesignSpec.md §34 -- adults arrive via signup/invite, not
// this form; see app/api/family/setup/route.ts). No `role` field here on purpose.
export const familyMemberCreateSchema = z.object({
  name: trimmedString("name is required"),
  color: familyMemberColor,
  avatar: familyMemberAvatar.optional(),
  dateOfBirth: dateOfBirth.optional(),
});

// `active` toggles deactivate/reactivate. `role` is immutable after creation this phase.
export const familyMemberUpdateSchema = z.object({
  name: trimmedString("name is required").optional(),
  color: familyMemberColor.optional(),
  avatar: familyMemberAvatar.optional(),
  dateOfBirth: dateOfBirth.optional(),
  active: z.boolean().optional(),
});

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

const calendarDateOnly = dateOnlySchema;

const timedEventFields = z.object({
  allDay: z.literal(false),
  startAt: z.string().datetime({ message: "Invalid start time" }),
  endAt: z.string().datetime({ message: "Invalid end time" }),
});

const allDayEventFields = z.object({
  allDay: z.literal(true),
  startDate: calendarDateOnly,
  endDate: calendarDateOnly,
});

const calendarEventBaseFields = z.object({
  title: trimmedString("title is required"),
  notes: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  participantIds: z
    .array(z.number().int())
    .min(1, "select at least one participant"),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrenceEndDate: calendarDateOnly.optional(),
});

export const calendarEventCreateSchema = z
  .discriminatedUnion("allDay", [timedEventFields, allDayEventFields])
  .and(calendarEventBaseFields)
  .refine(
    (data) =>
      data.allDay
        ? data.endDate >= data.startDate
        : new Date(data.endAt) > new Date(data.startAt),
    { message: "End must be after start", path: ["endAt"] }
  );

export const calendarEventUpdateSchema = z
  .object({
    title: trimmedString("title is required").optional(),
    notes: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
    allDay: z.boolean().optional(),
    startAt: z.string().datetime({ message: "Invalid start time" }).optional(),
    endAt: z.string().datetime({ message: "Invalid end time" }).optional(),
    startDate: calendarDateOnly.optional(),
    endDate: calendarDateOnly.optional(),
    participantIds: z
      .array(z.number().int())
      .min(1, "select at least one participant")
      .optional(),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
    recurrenceEndDate: calendarDateOnly.nullable().optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "no changes provided" }
  );

export const calendarEventRangeQuerySchema = z
  .object({
    start: z.string().datetime({ message: "Invalid start" }),
    end: z.string().datetime({ message: "Invalid end" }),
  })
  .refine((data) => new Date(data.end) > new Date(data.start), {
    message: "end must be after start",
    path: ["end"],
  })
  .refine(
    (data) =>
      new Date(data.end).getTime() - new Date(data.start).getTime() <=
      1000 * 60 * 60 * 24 * 62,
    { message: "range too large", path: ["end"] }
  );

const choreDaysOfWeek = z
  .array(z.number().int().min(0).max(6))
  .min(1, "select at least one day");

export const choreCreateSchema = z.object({
  title: trimmedString("title is required"),
  description: z.string().max(2000).optional(),
  familyMemberId: z.number({ error: "assignee is required" }).int(),
  daysOfWeek: choreDaysOfWeek,
});

export const choreUpdateSchema = z
  .object({
    title: trimmedString("title is required").optional(),
    description: z.string().max(2000).optional(),
    active: z.boolean().optional(),
    familyMemberId: z.number().int().optional(),
    daysOfWeek: choreDaysOfWeek.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "no changes provided",
  });

export const choreOccurrenceStatusSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]),
});

const routineDaysOfWeek = z
  .array(z.number().int().min(0).max(6))
  .min(1, "select at least one day");

const routinePeriod = z.enum(["MORNING", "AFTERNOON", "EVENING"], {
  message: "invalid period",
});

const routineItems = z
  .array(trimmedString("item title is required"))
  .min(1, "add at least one item");

export const routineCreateSchema = z.object({
  name: trimmedString("name is required"),
  period: routinePeriod,
  familyMemberId: z.number({ error: "assignee is required" }).int(),
  daysOfWeek: routineDaysOfWeek,
  activeDuringHoliday: z.boolean().optional(),
  items: routineItems,
});

export const routineUpdateSchema = z
  .object({
    name: trimmedString("name is required").optional(),
    period: routinePeriod.optional(),
    active: z.boolean().optional(),
    familyMemberId: z.number().int().optional(),
    daysOfWeek: routineDaysOfWeek.optional(),
    activeDuringHoliday: z.boolean().optional(),
    items: routineItems.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "no changes provided",
  });

export const routineItemCompletionSchema = z.object({
  completed: z.boolean(),
});

export const shoppingItemCategory = z.enum(["GROCERIES", "OTHER"]);

export const shoppingItemCreateSchema = z.object({
  name: trimmedString("name is required"),
  category: shoppingItemCategory.optional(),
});

export const shoppingItemUpdateSchema = z.object({
  checked: z.boolean(),
});

export const specialOccasionType = z.enum(["BIRTHDAY", "ANNIVERSARY"], {
  message: "invalid type",
});

// Plain YYYY-MM-DD, not a full timestamp -- same convention as dateOfBirth above. The year
// carried by this date doubles as the "initiating year" used to compute age/years-since.
const specialOccasionDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

export const specialOccasionCreateSchema = z.object({
  title: trimmedString("title is required"),
  type: specialOccasionType,
  originalDate: specialOccasionDate,
  isSomber: z.boolean().optional(),
});

export const specialOccasionUpdateSchema = z
  .object({
    title: trimmedString("title is required").optional(),
    type: specialOccasionType.optional(),
    originalDate: specialOccasionDate.optional(),
    isSomber: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "no changes provided",
  });

export const photoAlbumCreateSchema = z.object({
  name: trimmedString("album name is required"),
});

export const photoAlbumUpdateSchema = z.object({
  name: trimmedString("album name is required"),
});

// Recorded after the client uploads the file directly to Vercel Blob (see lib/photos.ts) --
// this only persists the resulting metadata, it never receives the file itself.
export const photoCreateSchema = z.object({
  blobUrl: z.string().url("invalid blob url"),
  blobPathname: trimmedString("pathname is required"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const todoCreateSchema = z.object({
  text: trimmedString("text is required"),
  userId: z.number({ error: "userId is required" }).int({ message: "userId is required" }),
  priority: z.boolean().optional(),
});

export const todoUpdateSchema = z
  .object({
    text: trimmedString("text is required").optional(),
    completed: z.boolean().optional(),
    priority: z.boolean().optional(),
  })
  .refine((data) => data.text !== undefined || data.completed !== undefined || data.priority !== undefined, {
    message: "no changes provided",
  });
