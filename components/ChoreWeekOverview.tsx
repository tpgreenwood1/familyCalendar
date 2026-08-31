"use client";

import { useQuery } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { ChoreOccurrenceDTO } from "@/lib/chores";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function fetchOccurrencesWeek(): Promise<{ weekStart: Date; occurrences: ChoreOccurrenceDTO[] }> {
  const res = await fetch("/api/chores/occurrences/week");
  if (!res.ok) throw new Error("Could not load this week's chores");
  return res.json();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ChoreWeekOverview({
  member,
  weekStart: initialWeekStart,
  initialOccurrences,
}: {
  member: FamilyMember;
  weekStart: Date;
  initialOccurrences: ChoreOccurrenceDTO[];
}) {
  const { data } = useQuery({
    queryKey: ["chore-occurrences-week"],
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
    const occurrences = memberOccurrences.filter(
      (o) => Math.round((new Date(o.date).getTime() - weekStart.getTime()) / ONE_DAY_MS) === i
    );
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

          {day.occurrences.length === 0 && <p className="text-sm text-gray-500">No chores.</p>}

          <ul>
            {day.occurrences.map((occurrence) => (
              <li key={occurrence.id} className="border-b border-gray-800 py-2 last:border-0">
                <span
                  className={`text-sm ${
                    occurrence.status === "COMPLETED"
                      ? "text-gray-500 line-through"
                      : occurrence.status === "SKIPPED"
                        ? "text-gray-500"
                        : "text-white"
                  }`}
                >
                  {occurrence.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
