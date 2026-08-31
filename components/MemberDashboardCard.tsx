"use client";

import type { FamilyMember, Todo } from "@prisma/client";
import type { ChoreOccurrenceDTO } from "@/lib/chores";
import type { RoutineOccurrenceDTO } from "@/lib/routines";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";

const PERIOD_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};
const PERIOD_ORDER = ["MORNING", "AFTERNOON", "EVENING"];

export default function MemberDashboardCard({
  member,
  choreOccurrences,
  routineOccurrences,
  todos,
  onCompleteChore,
  onSkipChore,
  onResetChore,
  onToggleRoutineItem,
  onToggleTodo,
  large = false,
}: {
  member: FamilyMember;
  choreOccurrences: ChoreOccurrenceDTO[];
  routineOccurrences: RoutineOccurrenceDTO[];
  todos: Todo[];
  onCompleteChore: (id: number) => void;
  onSkipChore: (id: number) => void;
  onResetChore: (id: number) => void;
  onToggleRoutineItem: (occurrenceId: number, itemId: number, completed: boolean) => void;
  onToggleTodo: (id: number, completed: boolean) => void;
  /** Bigger type and touch targets for the wall display (DesignSpec.md §18) — same data,
   * legible from across a room and comfortably tappable by children. */
  large?: boolean;
}) {
  const color = getFamilyMemberColor(member.color);
  const activeTodos = todos.filter((t) => !t.completed);
  const routinesByPeriod = [...routineOccurrences].sort(
    (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
  );

  const routineItemTotal = routineOccurrences.reduce((n, o) => n + o.items.length, 0);
  const routineItemDone = routineOccurrences.reduce(
    (n, o) => n + o.items.filter((i) => i.completed).length,
    0
  );
  const choresDone = choreOccurrences.filter((o) => o.status !== "PENDING").length;
  const totalDue = choreOccurrences.length + routineItemTotal + activeTodos.length;
  const totalDone = choresDone + routineItemDone;

  const isEmpty = choreOccurrences.length === 0 && routineOccurrences.length === 0 && activeTodos.length === 0;

  const checkboxSize = large ? "h-10 w-10" : "h-6 w-6";
  const rowText = large ? "text-2xl" : "text-base";
  const rowGap = large ? "gap-4 py-4" : "gap-3 py-2";
  const sectionHeading = large
    ? "mb-3 text-lg font-medium uppercase tracking-wide text-gray-400"
    : "mb-2 text-sm font-medium uppercase tracking-wide text-gray-400";

  return (
    <div className={`rounded-xl border-t-4 bg-gray-900 ${large ? "p-8" : "p-6"} ${color.accent}`}>
      <div className={`flex items-baseline justify-between ${large ? "mb-6" : "mb-4"}`}>
        <h2 className={`font-medium text-white ${large ? "text-4xl" : "text-2xl"}`}>{member.name}</h2>
        {totalDue > 0 && (
          <span className={large ? "text-lg text-gray-500" : "text-sm text-gray-500"}>
            {totalDone}/{totalDue} done
          </span>
        )}
      </div>

      {isEmpty && (
        <p className={large ? "text-xl text-gray-500" : "text-sm text-gray-500"}>Nothing due today.</p>
      )}

      {choreOccurrences.length > 0 && (
        <div className="mb-5">
          <h3 className={sectionHeading}>Chores</h3>
          <ul>
            {choreOccurrences.map((occurrence) => (
              <li key={occurrence.id} className={`flex items-center border-b border-gray-800 ${rowGap}`}>
                <input
                  type="checkbox"
                  checked={occurrence.status === "COMPLETED"}
                  onChange={(e) =>
                    e.target.checked ? onCompleteChore(occurrence.id) : onResetChore(occurrence.id)
                  }
                  className={`${checkboxSize} shrink-0 accent-gray-500`}
                />
                <span
                  className={`flex-1 truncate ${rowText} ${
                    occurrence.status === "COMPLETED"
                      ? "text-gray-500 line-through"
                      : occurrence.status === "SKIPPED"
                        ? "text-gray-500"
                        : "text-white"
                  }`}
                >
                  {occurrence.title}
                </span>
                {occurrence.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => onSkipChore(occurrence.id)}
                    className={`shrink-0 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white ${
                      large ? "px-4 py-2 text-base" : "px-2 py-1 text-xs"
                    }`}
                  >
                    Skip
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {routinesByPeriod.map((occurrence) => (
        <div key={occurrence.id} className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className={sectionHeading}>
              {PERIOD_LABELS[occurrence.period] ?? occurrence.period} · {occurrence.name}
            </h3>
            <span className={large ? "text-base text-gray-500" : "text-xs text-gray-500"}>
              {occurrence.items.filter((i) => i.completed).length}/{occurrence.items.length}
            </span>
          </div>
          <ul>
            {occurrence.items.map((item) => (
              <li key={item.id} className={`flex items-center border-b border-gray-800 ${rowGap}`}>
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={(e) => onToggleRoutineItem(occurrence.id, item.id, e.target.checked)}
                  className={`${checkboxSize} shrink-0 accent-gray-500`}
                />
                <span className={`flex-1 truncate ${rowText} ${item.completed ? "text-gray-500 line-through" : "text-white"}`}>
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {activeTodos.length > 0 && (
        <div>
          <h3 className={sectionHeading}>To Do</h3>
          <ul>
            {activeTodos.map((todo) => (
              <li key={todo.id} className={`flex items-center border-b border-gray-800 ${rowGap}`}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={(e) => onToggleTodo(todo.id, e.target.checked)}
                  className={`${checkboxSize} shrink-0 accent-gray-500`}
                />
                <span className={`flex-1 truncate ${rowText} text-white`}>{todo.text}</span>
                {todo.priority && (
                  <span className={`shrink-0 text-amber-400 ${large ? "text-2xl" : "text-lg"}`}>★</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
