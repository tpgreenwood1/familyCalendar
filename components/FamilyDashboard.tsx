"use client";

import Link from "next/link";
import type { FamilyMember, Todo } from "@prisma/client";
import type { ChoreOccurrenceDTO } from "@/lib/chores";
import type { RoutineOccurrenceDTO } from "@/lib/routines";
import type { CalendarOccurrenceDTO } from "@/lib/calendar";
import type { ShoppingItemDTO } from "@/lib/shopping";
import type { SpecialOccasionDTO } from "@/lib/specialOccasions";
import { useDashboardQueries } from "@/lib/useDashboardQueries";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import MemberDashboardCard from "@/components/MemberDashboardCard";
import ShoppingList from "@/components/ShoppingList";
import SpecialOccasionCard from "@/components/SpecialOccasionCard";
import FuturePlaceholderTiles from "@/components/FuturePlaceholderTiles";

function formatEventTime(occurrence: CalendarOccurrenceDTO): string {
  if (occurrence.allDay) return "All day";
  return new Date(occurrence.startAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FamilyDashboard({
  familyMembers,
  initialTodos,
  initialChoreOccurrences,
  initialRoutineOccurrences,
  initialEvents,
  initialShoppingItems,
  initialSpecialOccasions,
}: {
  familyMembers: FamilyMember[];
  initialTodos: Todo[];
  initialChoreOccurrences: ChoreOccurrenceDTO[];
  initialRoutineOccurrences: RoutineOccurrenceDTO[];
  initialEvents: CalendarOccurrenceDTO[];
  initialShoppingItems: ShoppingItemDTO[];
  initialSpecialOccasions: SpecialOccasionDTO[];
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

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="w-full">
      <h2 className="mb-6 text-xl text-gray-400">{todayLabel}</h2>

      <div className="mb-8 rounded-xl border-t-4 border-gray-500 bg-gray-900 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-2xl font-medium text-white">Today&apos;s Calendar</h3>
          <Link href="/calendar" className="text-sm text-gray-400 hover:text-white">
            Full calendar →
          </Link>
        </div>
        {events.length === 0 && <p className="text-sm text-gray-500">No events today.</p>}
        <ul>
          {events.map((occurrence, i) => (
            <li
              key={`${occurrence.eventId}-${occurrence.startAt}-${i}`}
              className="flex items-center gap-3 border-b border-gray-800 py-3"
            >
              <span className="w-20 shrink-0 text-sm text-gray-500">{formatEventTime(occurrence)}</span>
              <span className="flex-1 truncate text-base text-white">{occurrence.title}</span>
              <span className="flex shrink-0 gap-1">
                {occurrence.participants.map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className={`h-3 w-3 rounded-full ${getFamilyMemberColor(p.color).swatch}`}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <SpecialOccasionCard initialOccasions={initialSpecialOccasions} />

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {familyMembers.map((member) => (
          <MemberDashboardCard
            key={member.id}
            member={member}
            choreOccurrences={choreOccurrences.filter((o) => o.familyMemberId === member.id)}
            routineOccurrences={routineOccurrences.filter((o) => o.familyMemberId === member.id)}
            todos={todos.filter((t) => t.userId === member.id)}
            onCompleteChore={onCompleteChore}
            onSkipChore={onSkipChore}
            onResetChore={onResetChore}
            onToggleRoutineItem={onToggleRoutineItem}
            onToggleTodo={onToggleTodo}
          />
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-gray-500">{error}</p>}

      <ShoppingList initialItems={initialShoppingItems} />

      <div className="mt-8">
        <FuturePlaceholderTiles />
      </div>
    </div>
  );
}
