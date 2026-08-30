"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { ChoreDTO, ChoreOccurrenceDTO } from "@/lib/chores";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import ChoreColumn from "@/components/ChoreColumn";
import ChoreModal, { type ChoreFormPayload } from "@/components/ChoreModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function fetchChores(): Promise<ChoreDTO[]> {
  const res = await fetch("/api/chores");
  if (!res.ok) throw new Error("Could not load chores");
  return res.json();
}

async function fetchOccurrences(): Promise<ChoreOccurrenceDTO[]> {
  const res = await fetch("/api/chores/occurrences");
  if (!res.ok) throw new Error("Could not load today's chores");
  return res.json();
}

function daysLabel(daysOfWeek: number[]): string {
  const sorted = [...daysOfWeek].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return "Weekdays";
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return "Weekends";
  return sorted.map((d) => DAY_LABELS[d]).join(", ");
}

type ModalState = { mode: "create" } | { mode: "edit"; chore: ChoreDTO } | null;

export default function ChoreBoard({
  initialChores,
  initialOccurrences,
  familyMembers,
}: {
  initialChores: ChoreDTO[];
  initialOccurrences: ChoreOccurrenceDTO[];
  familyMembers: FamilyMember[];
}) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: chores = [] } = useQuery({
    queryKey: ["chores"],
    queryFn: fetchChores,
    initialData: initialChores,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["chore-occurrences"],
    queryFn: fetchOccurrences,
    initialData: initialOccurrences,
    refetchInterval: subscribeToFamilyEvents(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["chores"] });
    queryClient.invalidateQueries({ queryKey: ["chore-occurrences"] });
  }

  const createChore = useMutation({
    mutationFn: async (payload: ChoreFormPayload) => {
      const res = await fetch("/api/chores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not add chore. Please try again."),
  });

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

  const setOccurrenceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "PENDING" | "COMPLETED" | "SKIPPED" }) => {
      const res = await fetch(`/api/chores/occurrences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    },
    onMutate: async ({ id, status }) => {
      const previous = queryClient.getQueryData<ChoreOccurrenceDTO[]>(["chore-occurrences"]) ?? [];
      queryClient.setQueryData<ChoreOccurrenceDTO[]>(["chore-occurrences"], (prev = []) =>
        prev.map((o) => (o.id === id ? { ...o, status } : o))
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(["chore-occurrences"], context.previous);
      setError("Could not update chore. Please try again.");
    },
  });

  async function handleCreate(payload: ChoreFormPayload): Promise<boolean> {
    try {
      await createChore.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }

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

  function openEdit(choreId: number) {
    const chore = chores.find((c) => c.id === choreId);
    if (chore) setModal({ mode: "edit", chore });
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          disabled={familyMembers.length === 0}
          className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
        >
          + Add chore
        </button>
      </div>

      <div className="flex w-full gap-6 overflow-x-auto pb-4">
        {familyMembers.map((member) => (
          <ChoreColumn
            key={member.id}
            member={member}
            occurrences={occurrences.filter((o) => o.familyMemberId === member.id)}
            onComplete={(id) => setOccurrenceStatus.mutate({ id, status: "COMPLETED" })}
            onSkip={(id) => setOccurrenceStatus.mutate({ id, status: "SKIPPED" })}
            onReset={(id) => setOccurrenceStatus.mutate({ id, status: "PENDING" })}
            onEditChore={openEdit}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {chores.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-xl font-medium text-white">All chores</h3>
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {chores.map((chore) => {
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
                    onClick={() => setModal({ mode: "edit", chore })}
                    className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    Edit
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {modal && (
        <ChoreModal
          chore={modal.mode === "edit" ? modal.chore : undefined}
          familyMembers={familyMembers}
          onClose={() => setModal(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
