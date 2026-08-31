import { DateTime } from "luxon";
import type { Chore, ChoreOccurrence, ChoreOccurrenceStatus, ChoreSchedule } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FamilyContext } from "@/lib/authz";
import { ApiError } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import { getFamilyTimezone } from "@/lib/calendar";
import { capitalize } from "@/lib/textFormat";
import type { choreCreateSchema, choreUpdateSchema } from "@/lib/schemas";

type CreateChoreInput = z.infer<typeof choreCreateSchema>;
type UpdateChoreInput = z.infer<typeof choreUpdateSchema>;

type ChoreWithSchedule = Chore & { schedules: ChoreSchedule[] };

export type ChoreDTO = {
  id: number;
  title: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  familyMemberId: number;
  daysOfWeek: number[];
};

export type ChoreOccurrenceDTO = {
  id: number;
  choreId: number;
  title: string;
  description: string | null;
  familyMemberId: number;
  date: Date;
  status: ChoreOccurrenceStatus;
  completedAt: Date | null;
  skippedAt: Date | null;
};

const choreInclude = { schedules: true } as const;

function toChoreDTO(chore: ChoreWithSchedule): ChoreDTO {
  // V1 (§13.2/§13.6) is exactly one schedule per chore -- see schema.prisma's ChoreSchedule comment.
  const schedule = chore.schedules[0];
  return {
    id: chore.id,
    title: chore.title,
    description: chore.description,
    active: chore.active,
    createdAt: chore.createdAt,
    updatedAt: chore.updatedAt,
    familyMemberId: schedule.familyMemberId,
    daysOfWeek: schedule.daysOfWeek,
  };
}

function toOccurrenceDTO(occurrence: ChoreOccurrence & { chore: Chore }): ChoreOccurrenceDTO {
  return {
    id: occurrence.id,
    choreId: occurrence.choreId,
    title: occurrence.chore.title,
    description: occurrence.chore.description,
    familyMemberId: occurrence.familyMemberId,
    date: occurrence.date,
    status: occurrence.status,
    completedAt: occurrence.completedAt,
    skippedAt: occurrence.skippedAt,
  };
}

async function assertFamilyMemberInFamily(familyGroupId: number, familyMemberId: number): Promise<void> {
  const count = await prisma.familyMember.count({ where: { id: familyMemberId, familyGroupId } });
  if (count === 0) throw new ApiError(400, "invalid assignee");
}

/** Family-local midnight for `forDateStr` (a YYYY-MM-DD date, defaulting to today), as
 * both a JS Date and its JS Date#getDay() weekday -- see ChoreSchedule.daysOfWeek's
 * convention in schema.prisma. Parsing the date string in the family's own timezone
 * (rather than converting an already-constructed UTC Date) avoids off-by-one-day bugs
 * for families outside UTC, matching how lib/calendar.ts handles all-day event dates. */
async function familyLocalDay(
  familyGroupId: number,
  forDateStr?: string
): Promise<{ date: Date; dayOfWeek: number }> {
  const timezone = await getFamilyTimezone(familyGroupId);
  const dt = (
    forDateStr ? DateTime.fromISO(forDateStr, { zone: timezone }) : DateTime.now().setZone(timezone)
  ).startOf("day");
  // Luxon's `weekday` is Monday=1..Sunday=7; `% 7` maps Sunday to 0, matching getDay().
  return { date: dt.toJSDate(), dayOfWeek: dt.weekday % 7 };
}

export async function listChores(ctx: FamilyContext): Promise<ChoreDTO[]> {
  const chores = await prisma.chore.findMany({
    where: { familyGroupId: ctx.familyGroupId },
    include: choreInclude,
    orderBy: { createdAt: "asc" },
  });
  return chores.map(toChoreDTO);
}

export async function createChore(ctx: FamilyContext, input: CreateChoreInput): Promise<ChoreDTO> {
  await assertFamilyMemberInFamily(ctx.familyGroupId, input.familyMemberId);

  const chore = await prisma.$transaction(async (tx) => {
    const created = await tx.chore.create({
      data: {
        title: capitalize(input.title),
        description: input.description,
        familyGroupId: ctx.familyGroupId,
      },
    });
    await tx.choreSchedule.create({
      data: {
        choreId: created.id,
        familyMemberId: input.familyMemberId,
        daysOfWeek: input.daysOfWeek,
      },
    });
    return tx.chore.findUniqueOrThrow({ where: { id: created.id }, include: choreInclude });
  });

  publishDomainEvent({ type: "CHORE_CREATED", familyGroupId: ctx.familyGroupId });

  return toChoreDTO(chore);
}

export async function updateChore(
  ctx: FamilyContext,
  id: number,
  input: UpdateChoreInput
): Promise<ChoreDTO> {
  const existing = await prisma.chore.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
    include: choreInclude,
  });
  if (!existing) throw new ApiError(404, "not found");

  if (input.familyMemberId !== undefined) {
    await assertFamilyMemberInFamily(ctx.familyGroupId, input.familyMemberId);
  }

  const chore = await prisma.$transaction(async (tx) => {
    await tx.chore.update({
      where: { id },
      data: {
        title: input.title !== undefined ? capitalize(input.title) : undefined,
        description: input.description,
        active: input.active,
      },
    });
    if (input.familyMemberId !== undefined || input.daysOfWeek !== undefined) {
      const schedule = existing.schedules[0];
      await tx.choreSchedule.update({
        where: { id: schedule.id },
        data: {
          familyMemberId: input.familyMemberId,
          daysOfWeek: input.daysOfWeek,
        },
      });
    }
    return tx.chore.findUniqueOrThrow({ where: { id }, include: choreInclude });
  });

  publishDomainEvent({ type: "CHORE_UPDATED", familyGroupId: ctx.familyGroupId });

  return toChoreDTO(chore);
}

export async function deleteChore(ctx: FamilyContext, id: number): Promise<void> {
  const existing = await prisma.chore.findFirst({ where: { id, familyGroupId: ctx.familyGroupId } });
  if (!existing) throw new ApiError(404, "not found");

  await prisma.chore.delete({ where: { id } });

  publishDomainEvent({ type: "CHORE_DELETED", familyGroupId: ctx.familyGroupId });
}

/**
 * Generates today's (or `forDate`'s) PENDING occurrences for every active chore whose
 * schedule applies on that weekday (§13.4). Safe to call repeatedly: the unique
 * constraint on (choreId, familyMemberId, date) plus `skipDuplicates` makes this
 * idempotent, so no cron/locking is needed -- callers just call it before reading.
 */
export async function generateChoreOccurrences(familyGroupId: number, forDateStr?: string): Promise<void> {
  const { date, dayOfWeek } = await familyLocalDay(familyGroupId, forDateStr);

  const schedules = await prisma.choreSchedule.findMany({
    where: { chore: { familyGroupId, active: true }, daysOfWeek: { has: dayOfWeek } },
    select: { choreId: true, familyMemberId: true },
  });
  if (schedules.length === 0) return;

  await prisma.choreOccurrence.createMany({
    data: schedules.map((s) => ({
      choreId: s.choreId,
      familyGroupId,
      familyMemberId: s.familyMemberId,
      date,
    })),
    skipDuplicates: true,
  });
}

export async function listChoreOccurrences(
  ctx: FamilyContext,
  forDateStr?: string
): Promise<ChoreOccurrenceDTO[]> {
  const { date } = await familyLocalDay(ctx.familyGroupId, forDateStr);

  await generateChoreOccurrences(ctx.familyGroupId, forDateStr);

  const occurrences = await prisma.choreOccurrence.findMany({
    where: { familyGroupId: ctx.familyGroupId, date },
    include: { chore: true },
    orderBy: { id: "asc" },
  });
  return occurrences.map(toOccurrenceDTO);
}

/**
 * The current week's (Monday-Sunday, ISO convention regardless of locale, matching
 * lib/calendarViewRange.ts's week boundary) occurrences for the whole family, generating
 * each of the 7 days first via the same idempotent generateChoreOccurrences used for a
 * single day. Used by the read-only per-member weekly overview (§13.8) -- callers filter
 * to one member client-side, the same way listChoreOccurrences's whole-family result is
 * filtered per-column on the main board.
 */
export async function listChoreOccurrencesForWeek(
  ctx: FamilyContext,
  anchorDateStr?: string
): Promise<{ weekStart: Date; occurrences: ChoreOccurrenceDTO[] }> {
  const timezone = await getFamilyTimezone(ctx.familyGroupId);
  const anchor = anchorDateStr
    ? DateTime.fromISO(anchorDateStr, { zone: timezone })
    : DateTime.now().setZone(timezone);
  const weekStartDt = anchor.startOf("week");
  const dayStrs = Array.from({ length: 7 }, (_, i) => weekStartDt.plus({ days: i }).toISODate()!);

  await Promise.all(dayStrs.map((dayStr) => generateChoreOccurrences(ctx.familyGroupId, dayStr)));

  const occurrences = await prisma.choreOccurrence.findMany({
    where: {
      familyGroupId: ctx.familyGroupId,
      date: { gte: weekStartDt.toJSDate(), lt: weekStartDt.plus({ days: 7 }).toJSDate() },
    },
    include: { chore: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  return { weekStart: weekStartDt.toJSDate(), occurrences: occurrences.map(toOccurrenceDTO) };
}

export async function setChoreOccurrenceStatus(
  ctx: FamilyContext,
  id: number,
  status: ChoreOccurrenceStatus
): Promise<ChoreOccurrenceDTO> {
  const existing = await prisma.choreOccurrence.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
  });
  if (!existing) throw new ApiError(404, "not found");

  const now = new Date();
  const occurrence = await prisma.choreOccurrence.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? now : null,
      skippedAt: status === "SKIPPED" ? now : null,
    },
    include: { chore: true },
  });

  publishDomainEvent({ type: "CHORE_OCCURRENCE_UPDATED", familyGroupId: ctx.familyGroupId });

  return toOccurrenceDTO(occurrence);
}
