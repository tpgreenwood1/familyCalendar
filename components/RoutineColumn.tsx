"use client";

import type { FamilyMember } from "@prisma/client";
import type { RoutineOccurrenceDTO } from "@/lib/routines";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";

const PERIOD_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};
const PERIOD_ORDER = ["MORNING", "AFTERNOON", "EVENING"];

export default function RoutineColumn({
  member,
  occurrences,
  onToggleItem,
  onEditRoutine,
}: {
  member: FamilyMember;
  occurrences: RoutineOccurrenceDTO[];
  onToggleItem: (occurrenceId: number, itemId: number, completed: boolean) => void;
  onEditRoutine: (routineId: number) => void;
}) {
  const color = getFamilyMemberColor(member.color);
  const byPeriod = [...occurrences].sort(
    (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
  );

  return (
    <div className={`w-80 shrink-0 rounded-xl border-t-4 bg-gray-900 p-6 ${color.accent}`}>
      <h2 className="mb-6 text-2xl font-medium text-white">{member.name}</h2>

      {byPeriod.length === 0 && <p className="text-sm text-gray-500">No routines today.</p>}

      {byPeriod.map((occurrence) => {
        const doneCount = occurrence.items.filter((i) => i.completed).length;
        return (
          <div key={occurrence.id} className="mb-6">
            <button
              type="button"
              onClick={() => onEditRoutine(occurrence.routineId)}
              className="mb-2 flex w-full items-baseline justify-between text-left"
            >
              <span className="text-sm font-medium uppercase tracking-wide text-gray-400">
                {PERIOD_LABELS[occurrence.period] ?? occurrence.period} · {occurrence.name}
              </span>
              <span className="text-xs text-gray-500">
                {doneCount}/{occurrence.items.length}
              </span>
            </button>
            <ul>
              {occurrence.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 border-b border-gray-800 py-3"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) => onToggleItem(occurrence.id, item.id, e.target.checked)}
                    className="h-7 w-7 shrink-0 accent-gray-500"
                  />
                  <span
                    className={`flex-1 truncate text-base ${
                      item.completed ? "text-gray-500 line-through" : "text-white"
                    }`}
                  >
                    {item.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
