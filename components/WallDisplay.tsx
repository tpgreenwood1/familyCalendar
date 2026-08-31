"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FamilyMember, Todo } from "@prisma/client";
import type { ChoreOccurrenceDTO } from "@/lib/chores";
import type { RoutineOccurrenceDTO } from "@/lib/routines";
import type { CalendarOccurrenceDTO } from "@/lib/calendar";
import type { ShoppingItemDTO } from "@/lib/shopping";
import type { SpecialOccasionDTO } from "@/lib/specialOccasions";
import type { ScreensaverSettingsDTO } from "@/lib/photos";
import { useDashboardQueries } from "@/lib/useDashboardQueries";
import { useIdleReturn } from "@/lib/useIdleReturn";
import { usePhotoScreensaver } from "@/lib/usePhotoScreensaver";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import MemberDashboardCard from "@/components/MemberDashboardCard";
import ShoppingList, { SHOPPING_ITEMS_QUERY_KEY, fetchShoppingItems } from "@/components/ShoppingList";
import SpecialOccasionList, {
  SPECIAL_OCCASIONS_QUERY_KEY,
  fetchSpecialOccasions,
} from "@/components/SpecialOccasionList";
import PhotoScreensaver from "@/components/PhotoScreensaver";
import FuturePlaceholderTiles from "@/components/FuturePlaceholderTiles";

/** How long the wall can sit on a member/shopping focus view with no touch before it
 * snaps back to the overview, per DesignSpec.md §18. */
const IDLE_RETURN_MS = 30_000;

function formatEventTime(occurrence: CalendarOccurrenceDTO): string {
  if (occurrence.allDay) return "All day";
  return new Date(occurrence.startAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function WallDisplay({
  familyMembers,
  initialTodos,
  initialChoreOccurrences,
  initialRoutineOccurrences,
  initialEvents,
  initialShoppingItems,
  initialSpecialOccasions,
  initialScreensaverSettings,
  loadError,
}: {
  familyMembers: FamilyMember[];
  initialTodos: Todo[];
  initialChoreOccurrences: ChoreOccurrenceDTO[];
  initialRoutineOccurrences: RoutineOccurrenceDTO[];
  initialEvents: CalendarOccurrenceDTO[];
  initialShoppingItems: ShoppingItemDTO[];
  initialSpecialOccasions: SpecialOccasionDTO[];
  initialScreensaverSettings: ScreensaverSettingsDTO;
  loadError?: string;
}) {
  const {
    todos,
    choreOccurrences,
    routineOccurrences,
    events,
    error,
    onCompleteChore,
    onSkipChore,
    onResetChore,
    onToggleRoutineItem,
    onToggleTodo,
  } = useDashboardQueries({
    initialTodos,
    initialChoreOccurrences,
    initialRoutineOccurrences,
    initialEvents,
  });

  const [focusedMemberId, setFocusedMemberId] = useState<number | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [occasionsOpen, setOccasionsOpen] = useState(false);
  const [screensaverOpen, setScreensaverOpen] = useState(false);
  const now = useClock();
  const screensaverSettings = usePhotoScreensaver(initialScreensaverSettings);

  const returnToOverview = () => {
    setFocusedMemberId(null);
    setShoppingOpen(false);
    setOccasionsOpen(false);
  };

  useIdleReturn(
    focusedMemberId !== null || shoppingOpen || occasionsOpen,
    IDLE_RETURN_MS,
    returnToOverview
  );

  // Automatic screensaver (DesignSpec.md §16B/§18): only while the wall is sitting on the
  // plain overview (nothing else focused, screensaver not already open) -- a second,
  // independent idle timer from the 30s one above, using the household's configured delay.
  const atOverview = focusedMemberId === null && !shoppingOpen && !occasionsOpen && !screensaverOpen;
  useIdleReturn(
    screensaverSettings.enabled && screensaverSettings.albumId !== null && atOverview,
    screensaverSettings.idleSeconds * 1000,
    () => setScreensaverOpen(true)
  );

  const focusedMember = familyMembers.find((m) => m.id === focusedMemberId) ?? null;

  const { data: shoppingItems = initialShoppingItems } = useQuery({
    queryKey: SHOPPING_ITEMS_QUERY_KEY,
    queryFn: fetchShoppingItems,
    initialData: initialShoppingItems,
    refetchInterval: subscribeToFamilyEvents(),
  });
  const uncheckedShoppingCount = shoppingItems.filter((i) => !i.checked).length;

  const { data: specialOccasions = initialSpecialOccasions } = useQuery({
    queryKey: SPECIAL_OCCASIONS_QUERY_KEY,
    queryFn: fetchSpecialOccasions,
    initialData: initialSpecialOccasions,
    refetchInterval: subscribeToFamilyEvents(),
  });
  const upcomingOccasions = specialOccasions.filter((o) => o.daysUntil <= 7);

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gray-950 text-white">
      {/* Wall mode is designed for landscape; nudge the household to rotate otherwise. */}
      <div className="fixed inset-0 z-50 hidden flex-col items-center justify-center gap-4 bg-gray-950 text-center portrait:flex">
        <span className="text-6xl">↻</span>
        <p className="text-2xl text-gray-300">Rotate to landscape for the wall display</p>
      </div>

      <header className="flex items-center justify-between px-10 py-6">
        <div>
          <p className="text-4xl font-light tracking-wide">{timeLabel}</p>
          <p className="text-lg text-gray-400">{dateLabel}</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-gray-700 px-5 py-2 text-base text-gray-400 hover:border-gray-500 hover:text-white"
        >
          Standard view
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto px-10 pb-10">
        {loadError && <p className="mb-4 text-lg text-gray-500">{loadError}</p>}
        {error && <p className="mb-4 text-lg text-gray-500">{error}</p>}

        {familyMembers.length === 0 && !loadError ? (
          <p className="text-2xl text-gray-400">
            No family members yet — add one from the Home page to get started.
          </p>
        ) : focusedMember ? (
          <div>
            <button
              type="button"
              onClick={returnToOverview}
              className="mb-6 rounded-xl bg-gray-900 px-6 py-4 text-xl text-gray-300 hover:bg-gray-800"
            >
              ◀ Back to everyone
            </button>
            <MemberDashboardCard
              member={focusedMember}
              choreOccurrences={choreOccurrences.filter((o) => o.familyMemberId === focusedMember.id)}
              routineOccurrences={routineOccurrences.filter((o) => o.familyMemberId === focusedMember.id)}
              todos={todos.filter((t) => t.userId === focusedMember.id)}
              onCompleteChore={onCompleteChore}
              onSkipChore={onSkipChore}
              onResetChore={onResetChore}
              onToggleRoutineItem={onToggleRoutineItem}
              onToggleTodo={onToggleTodo}
              large
            />
          </div>
        ) : shoppingOpen ? (
          <div>
            <button
              type="button"
              onClick={returnToOverview}
              className="mb-6 rounded-xl bg-gray-900 px-6 py-4 text-xl text-gray-300 hover:bg-gray-800"
            >
              ◀ Back to everyone
            </button>
            <ShoppingList initialItems={initialShoppingItems} />
          </div>
        ) : occasionsOpen ? (
          <div>
            <button
              type="button"
              onClick={returnToOverview}
              className="mb-6 rounded-xl bg-gray-900 px-6 py-4 text-xl text-gray-300 hover:bg-gray-800"
            >
              ◀ Back to everyone
            </button>
            <SpecialOccasionList initialOccasions={initialSpecialOccasions} />
          </div>
        ) : (
          <>
            <section className="mb-8 rounded-2xl border-t-4 border-gray-500 bg-gray-900 p-8">
              <h2 className="mb-4 text-3xl font-medium">Today&apos;s Calendar</h2>
              {events.length === 0 && <p className="text-xl text-gray-500">No events today.</p>}
              <ul className="flex gap-4 overflow-x-auto pb-2">
                {events.map((occurrence, i) => (
                  <li
                    key={`${occurrence.eventId}-${occurrence.startAt}-${i}`}
                    className="flex min-w-[16rem] shrink-0 flex-col gap-1 rounded-xl bg-gray-800 px-5 py-4"
                  >
                    <span className="text-lg text-gray-400">{formatEventTime(occurrence)}</span>
                    <span className="truncate text-xl text-white">{occurrence.title}</span>
                    <span className="flex gap-1">
                      {occurrence.participants.map((p) => (
                        <span
                          key={p.id}
                          title={p.name}
                          className={`h-4 w-4 rounded-full ${getFamilyMemberColor(p.color).swatch}`}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {familyMembers.map((member) => {
                const memberChores = choreOccurrences.filter((o) => o.familyMemberId === member.id);
                const memberRoutines = routineOccurrences.filter((o) => o.familyMemberId === member.id);
                const memberTodos = todos.filter((t) => t.userId === member.id && !t.completed);
                const routineItems = memberRoutines.reduce((n, o) => n + o.items.length, 0);
                const routineDone = memberRoutines.reduce(
                  (n, o) => n + o.items.filter((i) => i.completed).length,
                  0
                );
                const totalDue = memberChores.length + routineItems + memberTodos.length;
                const totalDone = memberChores.filter((o) => o.status !== "PENDING").length + routineDone;
                const color = getFamilyMemberColor(member.color);

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setFocusedMemberId(member.id)}
                    className={`flex min-h-[9rem] flex-col justify-between rounded-2xl border-t-4 bg-gray-900 p-6 text-left hover:bg-gray-800 ${color.accent}`}
                  >
                    <span className="text-3xl font-medium">{member.name}</span>
                    <span className="text-lg text-gray-400">
                      {totalDue === 0 ? "All done" : `${totalDone}/${totalDue} done today`}
                    </span>
                  </button>
                );
              })}
            </section>

            <button
              type="button"
              onClick={() => setShoppingOpen(true)}
              className="w-full rounded-2xl border-t-4 border-emerald-500 bg-gray-900 p-6 text-left hover:bg-gray-800"
            >
              <span className="text-3xl font-medium">Shopping List</span>
              <span className="ml-4 text-lg text-gray-400">
                {uncheckedShoppingCount === 0 ? "Nothing needed" : `${uncheckedShoppingCount} items needed`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setOccasionsOpen(true)}
              className="mt-6 w-full rounded-2xl border-t-4 border-amber-500 bg-gray-900 p-6 text-left hover:bg-gray-800"
            >
              <span className="text-3xl font-medium">Special Occasions</span>
              <span className="ml-4 text-lg text-gray-400">
                {upcomingOccasions.length === 0
                  ? "Nothing coming up"
                  : upcomingOccasions[0].isToday
                    ? `It's ${upcomingOccasions[0].title} today!`
                    : `${upcomingOccasions[0].title} in ${upcomingOccasions[0].daysUntil} days`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScreensaverOpen(true)}
              className="mt-6 w-full rounded-2xl border-t-4 border-sky-500 bg-gray-900 p-6 text-left hover:bg-gray-800"
            >
              <span className="text-3xl font-medium">📷 Photos</span>
              <span className="ml-4 text-lg text-gray-400">
                {screensaverSettings.albumName
                  ? `Play "${screensaverSettings.albumName}"`
                  : "No album selected"}
              </span>
            </button>

            <div className="mt-8">
              <FuturePlaceholderTiles large />
            </div>
          </>
        )}
      </main>

      {screensaverOpen && (
        <PhotoScreensaver
          photos={screensaverSettings.photos}
          intervalSeconds={screensaverSettings.intervalSeconds}
          onDismiss={() => setScreensaverOpen(false)}
        />
      )}
    </div>
  );
}
