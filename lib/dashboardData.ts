import type { FamilyMember, Todo } from "@prisma/client";
import type { FamilyContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listChoreOccurrences, type ChoreOccurrenceDTO } from "@/lib/chores";
import { listRoutineOccurrences, type RoutineOccurrenceDTO } from "@/lib/routines";
import { listEventsInRange, type CalendarOccurrenceDTO } from "@/lib/calendar";
import { listShoppingItems, type ShoppingItemDTO } from "@/lib/shopping";
import { listSpecialOccasions, type SpecialOccasionDTO } from "@/lib/specialOccasions";
import { getScreensaverSettings, type ScreensaverSettingsDTO } from "@/lib/photos";
import { getViewRange } from "@/lib/calendarViewRange";

export type DashboardData = {
  familyMembers: FamilyMember[];
  todos: Todo[];
  choreOccurrences: ChoreOccurrenceDTO[];
  routineOccurrences: RoutineOccurrenceDTO[];
  events: CalendarOccurrenceDTO[];
  shoppingItems: ShoppingItemDTO[];
  specialOccasions: SpecialOccasionDTO[];
  screensaverSettings: ScreensaverSettingsDTO;
  error?: string;
};

const EMPTY_SCREENSAVER_SETTINGS: ScreensaverSettingsDTO = {
  enabled: false,
  albumId: null,
  albumName: null,
  intervalSeconds: 10,
  idleSeconds: 300,
  photos: [],
};

/**
 * Shared by `/dashboard` (Phase 9) and `/wall` (Phase 10) — same underlying data, just
 * rendered in two different layouts, per DesignSpec.md §17/§18.
 */
export async function getDashboardData(ctx: FamilyContext): Promise<DashboardData> {
  try {
    const { start, end } = getViewRange("day", new Date(), 1);
    const [
      familyMembers,
      todos,
      choreOccurrences,
      routineOccurrences,
      events,
      shoppingItems,
      specialOccasions,
      screensaverSettings,
    ] = await Promise.all([
      prisma.familyMember.findMany({
        where: { familyGroupId: ctx.familyGroupId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      prisma.todo.findMany({
        where: { familyMember: { familyGroupId: ctx.familyGroupId } },
        orderBy: { createdAt: "asc" },
      }),
      listChoreOccurrences(ctx),
      listRoutineOccurrences(ctx),
      listEventsInRange(ctx, start, end),
      listShoppingItems(ctx),
      listSpecialOccasions(ctx),
      getScreensaverSettings(ctx),
    ]);
    // Force the same Date -> ISO string shape the client will see from fetch(), since
    // React Server Component props otherwise keep real Date instances (see app/calendar/page.tsx).
    return JSON.parse(
      JSON.stringify({
        familyMembers,
        todos,
        choreOccurrences,
        routineOccurrences,
        events,
        shoppingItems,
        specialOccasions,
        screensaverSettings,
      })
    );
  } catch {
    return {
      familyMembers: [],
      todos: [],
      choreOccurrences: [],
      routineOccurrences: [],
      events: [],
      shoppingItems: [],
      specialOccasions: [],
      screensaverSettings: EMPTY_SCREENSAVER_SETTINGS,
      error: "Could not connect to database",
    };
  }
}
