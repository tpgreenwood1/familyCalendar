"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { RoutineDTO, RoutineOccurrenceDTO } from "@/lib/routines";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import RoutineColumn from "@/components/RoutineColumn";
import RoutineModal, { type RoutineFormPayload } from "@/components/RoutineModal";

export async function fetchRoutines(): Promise<RoutineDTO[]> {
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useQuery({
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
        <div className="flex gap-3">
          <Link
            href="/routines/edit"
            className="rounded-lg px-5 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            Edit routines
          </Link>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={familyMembers.length === 0}
            className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
          >
            + Add routine
          </button>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {familyMembers.map((member) => (
          <RoutineColumn
            key={member.id}
            member={member}
            occurrences={occurrences.filter((o) => o.familyMemberId === member.id)}
            onToggleItem={(occurrenceId, itemId, completed) =>
              toggleItem.mutate({ occurrenceId, itemId, completed })
            }
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {showAddModal && (
        <RoutineModal
          familyMembers={familyMembers}
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
