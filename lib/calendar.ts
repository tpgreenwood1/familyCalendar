import { DateTime } from "luxon";
import type { CalendarEvent, EventParticipant, FamilyMember } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FamilyContext } from "@/lib/authz";
import { ApiError } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import {
  buildRRule,
  expandOccurrences,
  parseRecurrencePreset,
  getRecurrenceUntil,
  type RecurrencePreset,
} from "@/lib/recurrence";
import type { calendarEventCreateSchema, calendarEventUpdateSchema } from "@/lib/schemas";

type CreateEventInput = z.infer<typeof calendarEventCreateSchema>;
type UpdateEventInput = z.infer<typeof calendarEventUpdateSchema>;

type CalendarEventWithParticipants = CalendarEvent & {
  participants: (EventParticipant & { familyMember: FamilyMember })[];
};

export type CalendarOccurrence = {
  eventId: number;
  title: string;
  notes: string | null;
  location: string | null;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
  recurrence: RecurrencePreset;
  recurrenceEndDate: Date | null;
  participants: FamilyMember[];
};

// The shape actually seen on the client: dates cross the wire as ISO strings
// (both from `NextResponse.json()` and from the JSON round-trip app/calendar/page.tsx
// does before handing initial data to a Client Component), so client code should
// type against this, not `CalendarOccurrence`, wherever it does date arithmetic.
export type CalendarOccurrenceDTO = Omit<
  CalendarOccurrence,
  "startAt" | "endAt" | "recurrenceEndDate"
> & {
  startAt: string;
  endAt: string;
  recurrenceEndDate: string | null;
};

const eventInclude = { participants: { include: { familyMember: true } } } as const;

export async function getFamilyTimezone(familyGroupId: number): Promise<string> {
  const familyGroup = await prisma.familyGroup.findUniqueOrThrow({
    where: { id: familyGroupId },
    select: { timezone: true },
  });
  return familyGroup.timezone;
}

async function assertParticipantsInFamily(
  familyGroupId: number,
  participantIds: number[]
): Promise<void> {
  const count = await prisma.familyMember.count({
    where: { id: { in: participantIds }, familyGroupId },
  });
  if (count !== participantIds.length) {
    throw new ApiError(400, "invalid participant");
  }
}

function toOccurrence(
  event: CalendarEventWithParticipants,
  instance: { startAt: Date; endAt: Date }
): CalendarOccurrence {
  return {
    eventId: event.id,
    title: event.title,
    notes: event.notes,
    location: event.location,
    allDay: event.allDay,
    startAt: instance.startAt,
    endAt: instance.endAt,
    recurrence: parseRecurrencePreset(event.rrule),
    recurrenceEndDate: getRecurrenceUntil(event.rrule),
    participants: event.participants.map((p) => p.familyMember),
  };
}

export async function listEventsInRange(
  ctx: FamilyContext,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarOccurrence[]> {
  const timezone = await getFamilyTimezone(ctx.familyGroupId);

  const events = await prisma.calendarEvent.findMany({
    where: {
      familyGroupId: ctx.familyGroupId,
      startAt: { lte: rangeEnd },
      OR: [{ endAt: { gte: rangeStart } }, { rrule: { not: null } }],
    },
    include: eventInclude,
  });

  const occurrences: CalendarOccurrence[] = [];
  for (const event of events) {
    for (const instance of expandOccurrences(event, rangeStart, rangeEnd, timezone)) {
      occurrences.push(toOccurrence(event, instance));
    }
  }
  occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return occurrences;
}

export async function createCalendarEvent(
  ctx: FamilyContext,
  input: CreateEventInput
): Promise<CalendarOccurrence> {
  const timezone = await getFamilyTimezone(ctx.familyGroupId);
  await assertParticipantsInFamily(ctx.familyGroupId, input.participantIds);

  const startAt = input.allDay
    ? DateTime.fromISO(input.startDate, { zone: timezone }).startOf("day").toJSDate()
    : new Date(input.startAt);
  const endAt = input.allDay
    ? DateTime.fromISO(input.endDate, { zone: timezone }).plus({ days: 1 }).startOf("day").toJSDate()
    : new Date(input.endAt);

  const recurrenceEndDate = input.recurrenceEndDate
    ? DateTime.fromISO(input.recurrenceEndDate, { zone: timezone }).toJSDate()
    : null;
  const rrule = buildRRule(input.recurrence, startAt, timezone, recurrenceEndDate);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.calendarEvent.create({
      data: {
        title: input.title,
        notes: input.notes,
        location: input.location,
        startAt,
        endAt,
        allDay: input.allDay,
        rrule,
        familyGroupId: ctx.familyGroupId,
        createdByUserId: ctx.user.id,
      },
    });
    await tx.eventParticipant.createMany({
      data: input.participantIds.map((familyMemberId) => ({
        eventId: created.id,
        familyMemberId,
      })),
    });
    return tx.calendarEvent.findUniqueOrThrow({ where: { id: created.id }, include: eventInclude });
  });

  publishDomainEvent({ type: "CALENDAR_EVENT_CREATED", familyGroupId: ctx.familyGroupId });

  return toOccurrence(event, { startAt: event.startAt, endAt: event.endAt });
}

export async function updateCalendarEvent(
  ctx: FamilyContext,
  id: number,
  input: UpdateEventInput
): Promise<CalendarOccurrence> {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
  });
  if (!existing) throw new ApiError(404, "not found");

  const timezone = await getFamilyTimezone(ctx.familyGroupId);

  if (input.participantIds) {
    await assertParticipantsInFamily(ctx.familyGroupId, input.participantIds);
  }

  let startAt = existing.startAt;
  let endAt = existing.endAt;
  let allDay = existing.allDay;

  // Date fields always arrive as a complete set from the edit form (see
  // EventModal) -- a patch that changes any date field must include the full
  // matching pair rather than trying to merge a lone startAt/startDate onto
  // whatever shape the event had before.
  const wantsAllDay = input.allDay ?? allDay;
  const changingDates =
    input.startAt !== undefined ||
    input.endAt !== undefined ||
    input.startDate !== undefined ||
    input.endDate !== undefined ||
    input.allDay !== undefined;

  if (changingDates) {
    if (wantsAllDay) {
      if (!input.startDate || !input.endDate) {
        throw new ApiError(400, "startDate and endDate are required for an all-day event");
      }
      startAt = DateTime.fromISO(input.startDate, { zone: timezone }).startOf("day").toJSDate();
      endAt = DateTime.fromISO(input.endDate, { zone: timezone })
        .plus({ days: 1 })
        .startOf("day")
        .toJSDate();
    } else {
      if (!input.startAt || !input.endAt) {
        throw new ApiError(400, "startAt and endAt are required");
      }
      startAt = new Date(input.startAt);
      endAt = new Date(input.endAt);
    }
    allDay = wantsAllDay;
  }

  let rrule = existing.rrule;
  if (input.recurrence !== undefined || input.recurrenceEndDate !== undefined || changingDates) {
    const preset = input.recurrence ?? parseRecurrencePreset(existing.rrule);
    const recurrenceEndDate =
      input.recurrenceEndDate !== undefined
        ? input.recurrenceEndDate
          ? DateTime.fromISO(input.recurrenceEndDate, { zone: timezone }).toJSDate()
          : null
        : getRecurrenceUntil(existing.rrule);
    rrule = buildRRule(preset, startAt, timezone, recurrenceEndDate);
  }

  const event = await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.update({
      where: { id },
      data: {
        title: input.title,
        notes: input.notes,
        location: input.location,
        startAt,
        endAt,
        allDay,
        rrule,
      },
    });
    if (input.participantIds) {
      await tx.eventParticipant.deleteMany({ where: { eventId: id } });
      await tx.eventParticipant.createMany({
        data: input.participantIds.map((familyMemberId) => ({ eventId: id, familyMemberId })),
      });
    }
    return tx.calendarEvent.findUniqueOrThrow({ where: { id }, include: eventInclude });
  });

  publishDomainEvent({ type: "CALENDAR_EVENT_UPDATED", familyGroupId: ctx.familyGroupId });

  return toOccurrence(event, { startAt: event.startAt, endAt: event.endAt });
}

export async function deleteCalendarEvent(ctx: FamilyContext, id: number): Promise<void> {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
  });
  if (!existing) throw new ApiError(404, "not found");

  await prisma.calendarEvent.delete({ where: { id } });

  publishDomainEvent({ type: "CALENDAR_EVENT_DELETED", familyGroupId: ctx.familyGroupId });
}
