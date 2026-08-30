import { DateTime } from "luxon";
import type {
  Routine,
  RoutineItem,
  RoutineItemCompletion,
  RoutineOccurrence,
  RoutinePeriod,
  RoutineSchedule,
} from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FamilyContext } from "@/lib/authz";
import { ApiError } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import { getFamilyTimezone } from "@/lib/calendar";
import type { routineCreateSchema, routineUpdateSchema } from "@/lib/schemas";

type CreateRoutineInput = z.infer<typeof routineCreateSchema>;
type UpdateRoutineInput = z.infer<typeof routineUpdateSchema>;

type RoutineWithRelations = Routine & { schedule: RoutineSchedule | null; items: RoutineItem[] };
type OccurrenceWithRelations = RoutineOccurrence & {
  routine: Routine & { items: RoutineItem[] };
  completions: RoutineItemCompletion[];
};

export type RoutineItemDTO = { id: number; title: string; order: number };

export type RoutineDTO = {
  id: number;
  name: string;
  period: RoutinePeriod;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  familyMemberId: number;
  daysOfWeek: number[];
  activeDuringHoliday: boolean;
  items: RoutineItemDTO[];
};

export type RoutineOccurrenceItemDTO = RoutineItemDTO & { completed: boolean };

export type RoutineOccurrenceDTO = {
  id: number;
  routineId: number;
  name: string;
  period: RoutinePeriod;
  familyMemberId: number;
  date: Date;
  items: RoutineOccurrenceItemDTO[];
};

const routineInclude = { schedule: true, items: { orderBy: { order: "asc" as const } } } as const;
const occurrenceInclude = {
  routine: { include: { items: { orderBy: { order: "asc" as const } } } },
  completions: true,
} as const;

function toRoutineDTO(routine: RoutineWithRelations): RoutineDTO {
  // A Routine always has exactly one RoutineSchedule, created together in the same
  // transaction (see createRoutine) -- schedule is nullable only because Prisma requires
  // the non-FK side of a 1:1 relation to be optional.
  const schedule = routine.schedule!;
  return {
    id: routine.id,
    name: routine.name,
    period: routine.period,
    active: routine.active,
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt,
    familyMemberId: routine.familyMemberId,
    daysOfWeek: schedule.daysOfWeek,
    activeDuringHoliday: schedule.activeDuringHoliday,
    items: routine.items.map((item) => ({ id: item.id, title: item.title, order: item.order })),
  };
}

function toOccurrenceDTO(occurrence: OccurrenceWithRelations): RoutineOccurrenceDTO {
  const completedItemIds = new Set(occurrence.completions.map((c) => c.routineItemId));
  return {
    id: occurrence.id,
    routineId: occurrence.routineId,
    name: occurrence.routine.name,
    period: occurrence.routine.period,
    familyMemberId: occurrence.familyMemberId,
    date: occurrence.date,
    items: occurrence.routine.items.map((item) => ({
      id: item.id,
      title: item.title,
      order: item.order,
      completed: completedItemIds.has(item.id),
    })),
  };
}

async function assertFamilyMemberInFamily(familyGroupId: number, familyMemberId: number): Promise<void> {
  const count = await prisma.familyMember.count({ where: { id: familyMemberId, familyGroupId } });
  if (count === 0) throw new ApiError(400, "invalid assignee");
}

/** Family-local midnight for `forDateStr` (a YYYY-MM-DD date, defaulting to today), as
 * both a JS Date and its JS Date#getDay() weekday -- mirrors lib/chores.ts's familyLocalDay
 * (kept as a separate copy since Routines and Chores are independent domain modules). */
async function familyLocalDay(
  familyGroupId: number,
  forDateStr?: string
): Promise<{ date: Date; dayOfWeek: number }> {
  const timezone = await getFamilyTimezone(familyGroupId);
  const dt = (
    forDateStr ? DateTime.fromISO(forDateStr, { zone: timezone }) : DateTime.now().setZone(timezone)
  ).startOf("day");
  return { date: dt.toJSDate(), dayOfWeek: dt.weekday % 7 };
}

export async function listRoutines(ctx: FamilyContext): Promise<RoutineDTO[]> {
  const routines = await prisma.routine.findMany({
    where: { familyGroupId: ctx.familyGroupId },
    include: routineInclude,
    orderBy: { createdAt: "asc" },
  });
  return routines.map(toRoutineDTO);
}

export async function createRoutine(ctx: FamilyContext, input: CreateRoutineInput): Promise<RoutineDTO> {
  await assertFamilyMemberInFamily(ctx.familyGroupId, input.familyMemberId);

  const routine = await prisma.$transaction(async (tx) => {
    const created = await tx.routine.create({
      data: {
        name: input.name,
        period: input.period,
        familyGroupId: ctx.familyGroupId,
        familyMemberId: input.familyMemberId,
      },
    });
    await tx.routineSchedule.create({
      data: {
        routineId: created.id,
        daysOfWeek: input.daysOfWeek,
        activeDuringHoliday: input.activeDuringHoliday ?? false,
      },
    });
    await tx.routineItem.createMany({
      data: input.items.map((title, index) => ({ routineId: created.id, title, order: index })),
    });
    return tx.routine.findUniqueOrThrow({ where: { id: created.id }, include: routineInclude });
  });

  publishDomainEvent({ type: "ROUTINE_CREATED", familyGroupId: ctx.familyGroupId });

  return toRoutineDTO(routine);
}

export async function updateRoutine(
  ctx: FamilyContext,
  id: number,
  input: UpdateRoutineInput
): Promise<RoutineDTO> {
  const existing = await prisma.routine.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
    include: routineInclude,
  });
  if (!existing) throw new ApiError(404, "not found");

  if (input.familyMemberId !== undefined) {
    await assertFamilyMemberInFamily(ctx.familyGroupId, input.familyMemberId);
  }

  const routine = await prisma.$transaction(async (tx) => {
    await tx.routine.update({
      where: { id },
      data: {
        name: input.name,
        period: input.period,
        active: input.active,
        familyMemberId: input.familyMemberId,
      },
    });
    if (input.daysOfWeek !== undefined || input.activeDuringHoliday !== undefined) {
      const schedule = existing.schedule!;
      await tx.routineSchedule.update({
        where: { id: schedule.id },
        data: {
          daysOfWeek: input.daysOfWeek,
          activeDuringHoliday: input.activeDuringHoliday,
        },
      });
    }
    if (input.items !== undefined) {
      // Full replace rather than a per-item diff -- simplest option for V1, at the cost of
      // dropping any of today's item completions tied to the old rows (they cascade-delete
      // with the RoutineItem). Acceptable since editing a routine's checklist is rare
      // compared to ticking items day-to-day.
      await tx.routineItem.deleteMany({ where: { routineId: id } });
      await tx.routineItem.createMany({
        data: input.items.map((title, index) => ({ routineId: id, title, order: index })),
      });
    }
    return tx.routine.findUniqueOrThrow({ where: { id }, include: routineInclude });
  });

  publishDomainEvent({ type: "ROUTINE_UPDATED", familyGroupId: ctx.familyGroupId });

  return toRoutineDTO(routine);
}

export async function deleteRoutine(ctx: FamilyContext, id: number): Promise<void> {
  const existing = await prisma.routine.findFirst({ where: { id, familyGroupId: ctx.familyGroupId } });
  if (!existing) throw new ApiError(404, "not found");

  await prisma.routine.delete({ where: { id } });

  publishDomainEvent({ type: "ROUTINE_DELETED", familyGroupId: ctx.familyGroupId });
}

/**
 * Generates today's (or `forDate`'s) occurrence for every active routine whose schedule
 * applies on that weekday, skipping routines that don't opt in to holiday mode while the
 * family has it on (§15.4). Safe to call repeatedly, same as generateChoreOccurrences.
 */
export async function generateRoutineOccurrences(familyGroupId: number, forDateStr?: string): Promise<void> {
  const { date, dayOfWeek } = await familyLocalDay(familyGroupId, forDateStr);

  const familyGroup = await prisma.familyGroup.findUniqueOrThrow({
    where: { id: familyGroupId },
    select: { holidayMode: true },
  });

  const schedules = await prisma.routineSchedule.findMany({
    where: {
      routine: { familyGroupId, active: true },
      daysOfWeek: { has: dayOfWeek },
      ...(familyGroup.holidayMode ? { activeDuringHoliday: true } : {}),
    },
    select: { routineId: true, routine: { select: { familyMemberId: true } } },
  });
  if (schedules.length === 0) return;

  await prisma.routineOccurrence.createMany({
    data: schedules.map((s) => ({
      routineId: s.routineId,
      familyGroupId,
      familyMemberId: s.routine.familyMemberId,
      date,
    })),
    skipDuplicates: true,
  });
}

export async function listRoutineOccurrences(
  ctx: FamilyContext,
  forDateStr?: string
): Promise<RoutineOccurrenceDTO[]> {
  const { date } = await familyLocalDay(ctx.familyGroupId, forDateStr);

  await generateRoutineOccurrences(ctx.familyGroupId, forDateStr);

  const occurrences = await prisma.routineOccurrence.findMany({
    where: { familyGroupId: ctx.familyGroupId, date },
    include: occurrenceInclude,
    orderBy: { id: "asc" },
  });
  return occurrences.map(toOccurrenceDTO);
}

export async function setRoutineItemCompletion(
  ctx: FamilyContext,
  occurrenceId: number,
  itemId: number,
  completed: boolean
): Promise<RoutineOccurrenceDTO> {
  const occurrence = await prisma.routineOccurrence.findFirst({
    where: { id: occurrenceId, familyGroupId: ctx.familyGroupId },
  });
  if (!occurrence) throw new ApiError(404, "not found");

  const item = await prisma.routineItem.findFirst({
    where: { id: itemId, routineId: occurrence.routineId },
  });
  if (!item) throw new ApiError(404, "not found");

  if (completed) {
    await prisma.routineItemCompletion.upsert({
      where: {
        routineOccurrenceId_routineItemId: { routineOccurrenceId: occurrenceId, routineItemId: itemId },
      },
      create: { routineOccurrenceId: occurrenceId, routineItemId: itemId },
      update: {},
    });
  } else {
    await prisma.routineItemCompletion.deleteMany({
      where: { routineOccurrenceId: occurrenceId, routineItemId: itemId },
    });
  }

  publishDomainEvent({ type: "ROUTINE_ITEM_COMPLETION_UPDATED", familyGroupId: ctx.familyGroupId });

  const updated = await prisma.routineOccurrence.findUniqueOrThrow({
    where: { id: occurrenceId },
    include: occurrenceInclude,
  });
  return toOccurrenceDTO(updated);
}
