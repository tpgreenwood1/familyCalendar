"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { RoutineDTO, RoutineOccurrenceDTO } from "@/lib/routines";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import RoutineColumn from "@/components/RoutineColumn";
import RoutineModal, { type RoutineFormPayload } from "@/components/RoutineModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIOD_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

async function fetchRoutines(): Promise<RoutineDTO[]> {
  const res = await fetch("/api/routines");
  if (!res.ok) throw new Error("Could not load routines");
  return res.json();
}

async function fetchOccurrences(): Promise<RoutineOccurrenceDTO[]> {
  const res = await fetch("/api/routines/occurrences");
  if (!res.ok) throw new Error("Could not load today's routines");
  return res.json();
}

async function fetchFamilyGroup(): Promise<{ name: string; holidayMode: boolean }> {
  const res = await fetch("/api/family-group");
  if (!res.ok) throw new Error("Could not load family settings");
  return res.json();
}

function daysLabel(daysOfWeek: number[]): string {
  const sorted = [...daysOfWeek].sort();
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return "Weekdays";
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return "Weekends";
  return sorted.map((d) => DAY_LABELS[d]).join(", ");
}

type ModalState = { mode: "create" } | { mode: "edit"; routine: RoutineDTO } | null;

export default function RoutineBoard({
  initialRoutines,
  initialOccurrences,
  initialHolidayMode,
  familyMembers,
}: {
  initialRoutines: RoutineDTO[];
  initialOccurrences: RoutineOccurrenceDTO[];
  initialHolidayMode: boolean;
  familyMembers: FamilyMember[];
}) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: routines = [] } = useQuery({
    queryKey: ["routines"],
    queryFn: fetchRoutines,
    initialData: initialRoutines,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: occurrences = [] } = useQuery({
    queryKey: ["routine-occurrences"],
    queryFn: fetchOccurrences,
    initialData: initialOccurrences,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: familyGroup } = useQuery({
    queryKey: ["family-group"],
    queryFn: fetchFamilyGroup,
    initialData: { name: "", holidayMode: initialHolidayMode },
    refetchInterval: subscribeToFamilyEvents(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["routines"] });
    queryClient.invalidateQueries({ queryKey: ["routine-occurrences"] });
  }

  const createRoutine = useMutation({
    mutationFn: async (payload: RoutineFormPayload) => {
      const res = await fetch("/api/routines", {
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
    onError: () => setError("Could not add routine. Please try again."),
  });

  const updateRoutine = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: RoutineFormPayload & { active: boolean };
    }) => {
      const res = await fetch(`/api/routines/${id}`, {
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
    onError: () => setError("Could not update routine. Please try again."),
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/routines/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not delete routine. Please try again."),
  });

  const toggleItem = useMutation({
    mutationFn: async ({
      occurrenceId,
      itemId,
      completed,
    }: {
      occurrenceId: number;
      itemId: number;
      completed: boolean;
    }) => {
      const res = await fetch(`/api/routines/occurrences/${occurrenceId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error();
    },
    onMutate: async ({ occurrenceId, itemId, completed }) => {
      const previous = queryClient.getQueryData<RoutineOccurrenceDTO[]>(["routine-occurrences"]) ?? [];
      queryClient.setQueryData<RoutineOccurrenceDTO[]>(["routine-occurrences"], (prev = []) =>
        prev.map((o) =>
          o.id === occurrenceId
            ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, completed } : i)) }
            : o
        )
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(["routine-occurrences"], context.previous);
      setError("Could not update routine. Please try again.");
    },
  });

  const toggleHolidayMode = useMutation({
    mutationFn: async (holidayMode: boolean) => {
      const res = await fetch("/api/family-group", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidayMode }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-group"] });
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not update holiday mode. Please try again."),
  });

  async function handleCreate(payload: RoutineFormPayload): Promise<boolean> {
    try {
      await createRoutine.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }

  async function handleUpdate(id: number, payload: RoutineFormPayload & { active: boolean }): Promise<boolean> {
    try {
      await updateRoutine.mutateAsync({ id, payload });
      return true;
    } catch {
      return false;
    }
  }

  async function handleDelete(id: number): Promise<boolean> {
    try {
      await deleteRoutine.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  }

  function openEdit(routineId: number) {
    const routine = routines.find((r) => r.id === routineId);
    if (routine) setModal({ mode: "edit", routine });
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white">
          <input
            type="checkbox"
            checked={familyGroup?.holidayMode ?? false}
            onChange={(e) => toggleHolidayMode.mutate(e.target.checked)}
            className="h-6 w-6 accent-gray-500"
          />
          Holiday mode
        </label>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          disabled={familyMembers.length === 0}
          className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
        >
          + Add routine
        </button>
      </div>

      <div className="flex w-full gap-6 overflow-x-auto pb-4">
        {familyMembers.map((member) => (
          <RoutineColumn
            key={member.id}
            member={member}
            occurrences={occurrences.filter((o) => o.familyMemberId === member.id)}
            onToggleItem={(occurrenceId, itemId, completed) =>
              toggleItem.mutate({ occurrenceId, itemId, completed })
            }
            onEditRoutine={openEdit}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {routines.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 text-xl font-medium text-white">All routines</h3>
          <ul className="mx-auto flex max-w-2xl flex-col gap-2">
            {routines.map((routine) => {
              const member = familyMembers.find((m) => m.id === routine.familyMemberId);
              const color = member ? getFamilyMemberColor(member.color) : null;
              return (
                <li
                  key={routine.id}
                  className={`flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 ${
                    routine.active ? "" : "opacity-50"
                  }`}
                >
                  <span className={`h-3 w-3 shrink-0 rounded-full ${color?.swatch ?? "bg-gray-600"}`} />
                  <span className="flex-1 truncate text-white">
                    {PERIOD_LABELS[routine.period] ?? routine.period} · {routine.name}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {member?.name ?? "Unassigned"} · {daysLabel(routine.daysOfWeek)}
                  </span>
                  {!routine.active && <span className="shrink-0 text-xs text-gray-500">Inactive</span>}
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", routine })}
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
        <RoutineModal
          routine={modal.mode === "edit" ? modal.routine : undefined}
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
