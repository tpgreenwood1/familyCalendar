import { DateTime } from "luxon";
import type { SpecialOccasion, SpecialOccasionType } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FamilyContext } from "@/lib/authz";
import { ApiError } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import { getFamilyTimezone } from "@/lib/calendar";
import type { specialOccasionCreateSchema, specialOccasionUpdateSchema } from "@/lib/schemas";

type CreateSpecialOccasionInput = z.infer<typeof specialOccasionCreateSchema>;
type UpdateSpecialOccasionInput = z.infer<typeof specialOccasionUpdateSchema>;

export type SpecialOccasionDTO = {
  id: number;
  title: string;
  type: SpecialOccasionType;
  originalDate: Date;
  isSomber: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** This year's (or next year's, if already passed) occurrence, in family-local terms. */
  nextOccurrenceDate: Date;
  /** 0 = today; never negative -- nextOccurrenceDate always resolves to today-or-later. */
  daysUntil: number;
  isToday: boolean;
  /** "turning N" for BIRTHDAY, "N years since" for ANNIVERSARY. */
  computedYears: number;
};

/** Family-local "today", start-of-day -- same getFamilyTimezone-via-Luxon approach as
 * lib/chores.ts#familyLocalDay, kept local to this module since it doesn't need a weekday. */
async function familyLocalToday(familyGroupId: number): Promise<DateTime> {
  const timezone = await getFamilyTimezone(familyGroupId);
  return DateTime.now().setZone(timezone).startOf("day");
}

/**
 * Pure date math, deliberately taking `today` as a parameter (rather than resolving it
 * itself) so it's unit-testable without a family/DB dependency -- see
 * lib/specialOccasions.test.ts, mirroring how lib/recurrence.test.ts feeds expandOccurrences
 * fixed Date objects rather than exercising getFamilyTimezone.
 *
 * `originalDate` was stored via the UTC-midnight convention (see lib/schemas.ts), so its
 * month/day are always read with the UTC getters, independent of the family's timezone.
 * A Feb 29 original is observed on Feb 28 in a non-leap candidate year (documented
 * convention, not Mar 1).
 */
export function computeOccasionFields(
  originalDate: Date,
  today: DateTime
): { nextOccurrenceDate: DateTime; daysUntil: number; isToday: boolean; computedYears: number } {
  const originYear = originalDate.getUTCFullYear();
  const month = originalDate.getUTCMonth() + 1;
  const day = originalDate.getUTCDate();

  function candidateFor(year: number): DateTime {
    const isFeb29 = month === 2 && day === 29;
    const observedDay = isFeb29 && !DateTime.local(year).isInLeapYear ? 28 : day;
    return DateTime.fromObject({ year, month, day: observedDay }, { zone: today.zone });
  }

  let candidate = candidateFor(today.year);
  if (candidate < today) candidate = candidateFor(today.year + 1);

  const daysUntil = Math.round(candidate.diff(today, "days").days);
  return {
    nextOccurrenceDate: candidate,
    daysUntil,
    isToday: daysUntil === 0,
    computedYears: candidate.year - originYear,
  };
}

function toSpecialOccasionDTO(occasion: SpecialOccasion, today: DateTime): SpecialOccasionDTO {
  const computed = computeOccasionFields(occasion.originalDate, today);
  return {
    id: occasion.id,
    title: occasion.title,
    type: occasion.type,
    originalDate: occasion.originalDate,
    isSomber: occasion.isSomber,
    createdAt: occasion.createdAt,
    updatedAt: occasion.updatedAt,
    nextOccurrenceDate: computed.nextOccurrenceDate.toJSDate(),
    daysUntil: computed.daysUntil,
    isToday: computed.isToday,
    computedYears: computed.computedYears,
  };
}

/** Ascending by daysUntil (soonest first); ties broken alphabetically by title for a stable,
 * deterministic order. */
export function sortByNextOccurrence(occasions: SpecialOccasionDTO[]): SpecialOccasionDTO[] {
  return [...occasions].sort(
    (a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title)
  );
}

export async function listSpecialOccasions(ctx: FamilyContext): Promise<SpecialOccasionDTO[]> {
  const today = await familyLocalToday(ctx.familyGroupId);
  const occasions = await prisma.specialOccasion.findMany({
    where: { familyGroupId: ctx.familyGroupId },
  });
  return sortByNextOccurrence(occasions.map((o) => toSpecialOccasionDTO(o, today)));
}

export async function createSpecialOccasion(
  ctx: FamilyContext,
  input: CreateSpecialOccasionInput
): Promise<SpecialOccasionDTO> {
  const today = await familyLocalToday(ctx.familyGroupId);
  const created = await prisma.specialOccasion.create({
    data: {
      title: input.title,
      type: input.type,
      originalDate: input.originalDate,
      isSomber: input.isSomber ?? false,
      familyGroupId: ctx.familyGroupId,
    },
  });

  publishDomainEvent({ type: "SPECIAL_OCCASION_CREATED", familyGroupId: ctx.familyGroupId });

  return toSpecialOccasionDTO(created, today);
}

export async function updateSpecialOccasion(
  ctx: FamilyContext,
  id: number,
  input: UpdateSpecialOccasionInput
): Promise<SpecialOccasionDTO> {
  const existing = await prisma.specialOccasion.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
  });
  if (!existing) throw new ApiError(404, "not found");

  const today = await familyLocalToday(ctx.familyGroupId);
  const updated = await prisma.specialOccasion.update({
    where: { id },
    data: {
      title: input.title,
      type: input.type,
      originalDate: input.originalDate,
      isSomber: input.isSomber,
    },
  });

  publishDomainEvent({ type: "SPECIAL_OCCASION_UPDATED", familyGroupId: ctx.familyGroupId });

  return toSpecialOccasionDTO(updated, today);
}

export async function deleteSpecialOccasion(ctx: FamilyContext, id: number): Promise<void> {
  const existing = await prisma.specialOccasion.findFirst({
    where: { id, familyGroupId: ctx.familyGroupId },
  });
  if (!existing) throw new ApiError(404, "not found");

  await prisma.specialOccasion.delete({ where: { id } });

  publishDomainEvent({ type: "SPECIAL_OCCASION_DELETED", familyGroupId: ctx.familyGroupId });
}
