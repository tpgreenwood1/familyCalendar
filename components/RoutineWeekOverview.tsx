"use client";

import { useQuery } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { RoutineOccurrenceDTO } from "@/lib/routines";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PERIOD_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};
const PERIOD_ORDER = ["MORNING", "AFTERNOON", "EVENING"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchOccurrencesWeek(): Promise<{ weekStart: Date; occurrences: RoutineOccurrenceDTO[] }> {
  const res = await fetch("/api/routines/occurrences/week");
  if (!res.ok) throw new Error("Could not load this week's routines");
  return res.json();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function RoutineWeekOverview({
  member,
  weekStart: initialWeekStart,
  initialOccurrences,
}: {
  member: FamilyMember;
  weekStart: Date;
  initialOccurrences: RoutineOccurrenceDTO[];
}) {
  const { data } = useQuery({
    queryKey: ["routine-occurrences-week"],
    queryFn: fetchOccurrencesWeek,
    initialData: { weekStart: initialWeekStart, occurrences: initialOccurrences },
    refetchInterval: subscribeToFamilyEvents(),
  });

  const color = getFamilyMemberColor(member.color);
  const weekStart = new Date(data.weekStart);
  const memberOccurrences = data.occurrences.filter((o) => o.familyMemberId === member.id);
  const today = new Date();

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * ONE_DAY_MS);
    const occurrences = [...memberOccurrences]
      .filter((o) => Math.round((new Date(o.date).getTime() - weekStart.getTime()) / ONE_DAY_MS) === i)
      .sort((a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period));
    return { date, label: DAY_LABELS[i], occurrences, isToday: isSameDay(date, today) };
  });

  return (
    <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => (
        <div key={day.label} className={`rounded-xl border-t-4 bg-gray-900 p-4 ${color.accent}`}>
          <p className={`mb-3 text-sm ${day.isToday ? "font-semibold text-honey-bronze" : "text-gray-400"}`}>
            {day.label} {day.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            {day.isToday && " · Today"}
          </p>

          {day.occurrences.length === 0 && <p className="text-sm text-gray-500">No routines.</p>}

          {day.occurrences.map((occurrence) => (
            <div key={occurrence.id} className="mb-3 last:mb-0">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                {PERIOD_LABELS[occurrence.period] ?? occurrence.period} · {occurrence.name}
              </p>
              <ul>
                {occurrence.items.map((item) => (
                  <li key={item.id} className="border-b border-gray-800 py-1 last:border-0">
                    <span className={`text-sm ${item.completed ? "text-gray-500 line-through" : "text-white"}`}>
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
