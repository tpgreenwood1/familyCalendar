"use client";

import Link from "next/link";
import type { FamilyMember } from "@prisma/client";
import type { ChoreOccurrenceDTO } from "@/lib/chores";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";

export default function ChoreColumn({
  member,
  occurrences,
  onComplete,
  onSkip,
  onReset,
}: {
  member: FamilyMember;
  occurrences: ChoreOccurrenceDTO[];
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
  onReset: (id: number) => void;
}) {
  const color = getFamilyMemberColor(member.color);

  return (
    <div className={`rounded-xl border-t-4 bg-gray-900 p-6 ${color.accent}`}>
      <Link href={`/chores/${member.id}`} className="mb-6 block text-2xl font-medium text-white hover:underline">
        {member.name}
      </Link>

      {occurrences.length === 0 && <p className="text-sm text-gray-500">No chores today.</p>}

      <ul>
        {occurrences.map((occurrence) => (
          <li
            key={occurrence.id}
            className="flex items-center gap-3 border-b border-gray-800 py-4"
          >
            <input
              type="checkbox"
              checked={occurrence.status === "COMPLETED"}
              onChange={(e) => (e.target.checked ? onComplete(occurrence.id) : onReset(occurrence.id))}
              className="h-8 w-8 shrink-0 accent-gray-500"
            />

            <span
              className={`flex-1 truncate text-base ${
                occurrence.status === "COMPLETED"
                  ? "text-gray-500 line-through"
                  : occurrence.status === "SKIPPED"
                    ? "text-gray-500"
                    : "text-white"
              }`}
            >
              {occurrence.title}
            </span>

            {occurrence.status === "SKIPPED" ? (
              <button
                type="button"
                onClick={() => onReset(occurrence.id)}
                className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Undo skip
              </button>
            ) : (
              occurrence.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => onSkip(occurrence.id)}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                >
                  Skip
                </button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
