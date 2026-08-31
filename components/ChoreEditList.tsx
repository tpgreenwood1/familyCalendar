"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { ChoreDTO } from "@/lib/chores";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import { getFamilyMemberAvatar } from "@/lib/familyMemberAvatars";
import { fetchChores } from "@/components/ChoreBoard";
import ChoreModal, { type ChoreFormPayload } from "@/components/ChoreModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysLabel(daysOfWeek: number[]): string {
  const sorted = [...daysOfWeek].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return "Weekdays";
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return "Weekends";
  return sorted.map((d) => DAY_LABELS[d]).join(", ");
}

export default function ChoreEditList({
  initialChores,
  familyMembers,
}: {
  initialChores: ChoreDTO[];
  familyMembers: FamilyMember[];
}) {
  const queryClient = useQueryClient();
  const [editingChore, setEditingChore] = useState<ChoreDTO | null>(null);
  const [filterMemberId, setFilterMemberId] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const { data: chores = [] } = useQuery({
    queryKey: ["chores"],
    queryFn: fetchChores,
    initialData: initialChores,
    refetchInterval: subscribeToFamilyEvents(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["chores"] });
    queryClient.invalidateQueries({ queryKey: ["chore-occurrences"] });
  }

  const updateChore = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: ChoreFormPayload & { active: boolean };
    }) => {
      const res = await fetch(`/api/chores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not update chore. Please try again."),
  });

  const deleteChore = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chores/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not delete chore. Please try again."),
  });

  async function handleUpdate(id: number, payload: ChoreFormPayload & { active: boolean }): Promise<boolean> {
    try {
      await updateChore.mutateAsync({ id, payload });
      return true;
    } catch {
      return false;
    }
  }

  async function handleDelete(id: number): Promise<boolean> {
    try {
      await deleteChore.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  }

  const filteredChores = chores.filter(
    (chore) => filterMemberId === "all" || chore.familyMemberId === filterMemberId
  );

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="mb-2 text-sm text-gray-400">Filter by member</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterMemberId("all")}
            className={`rounded-full border-2 border-transparent bg-gray-800 px-3 py-2 text-sm text-white ${
              filterMemberId === "all" ? "ring-2 ring-white" : "opacity-50"
            }`}
          >
            All
          </button>
          {familyMembers.map((member) => {
            const color = getFamilyMemberColor(member.color);
            const avatar = getFamilyMemberAvatar(member.avatar);
            const selected = filterMemberId === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setFilterMemberId(member.id)}
                className={`flex items-center gap-2 rounded-full border-2 bg-gray-800 px-3 py-2 text-sm text-white ${
                  color.accent
                } ${selected ? "ring-2 ring-white" : "opacity-50"}`}
              >
                <span>{avatar.emoji}</span>
                {member.name}
              </button>
            );
          })}
        </div>
      </div>

      {filteredChores.length === 0 && (
        <p className="text-gray-400">No chores{filterMemberId !== "all" ? " for this member" : ""} yet.</p>
      )}

      <ul className="flex flex-col gap-2">
        {filteredChores.map((chore) => {
          const member = familyMembers.find((m) => m.id === chore.familyMemberId);
          const color = member ? getFamilyMemberColor(member.color) : null;
          return (
            <li
              key={chore.id}
              className={`flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 ${
                chore.active ? "" : "opacity-50"
              }`}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${color?.swatch ?? "bg-gray-600"}`} />
              <span className="flex-1 truncate text-white">{chore.title}</span>
              <span className="shrink-0 text-sm text-gray-500">
                {member?.name ?? "Unassigned"} · {daysLabel(chore.daysOfWeek)}
              </span>
              {!chore.active && <span className="shrink-0 text-xs text-gray-500">Inactive</span>}
              <button
                type="button"
                onClick={() => setEditingChore(chore)}
                className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Edit
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {editingChore && (
        <ChoreModal
          chore={editingChore}
          familyMembers={familyMembers}
          onClose={() => setEditingChore(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
