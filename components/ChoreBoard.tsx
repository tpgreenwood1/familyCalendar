"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { ChoreDTO, ChoreOccurrenceDTO } from "@/lib/chores";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import ChoreColumn from "@/components/ChoreColumn";
import ChoreModal, { type ChoreFormPayload } from "@/components/ChoreModal";

export async function fetchChores(): Promise<ChoreDTO[]> {
  const res = await fetch("/api/chores");
  if (!res.ok) throw new Error("Could not load chores");
  return res.json();
}

async function fetchOccurrences(): Promise<ChoreOccurrenceDTO[]> {
  const res = await fetch("/api/chores/occurrences");
  if (!res.ok) throw new Error("Could not load today's chores");
  return res.json();
}

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useQuery({
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

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-end gap-3">
        <Link
          href="/chores/edit"
          className="rounded-lg px-5 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          Edit chores
        </Link>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={familyMembers.length === 0}
          className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
        >
          + Add chore
        </button>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {familyMembers.map((member) => (
          <ChoreColumn
            key={member.id}
            member={member}
            occurrences={occurrences.filter((o) => o.familyMemberId === member.id)}
            onComplete={(id) => setOccurrenceStatus.mutate({ id, status: "COMPLETED" })}
            onSkip={(id) => setOccurrenceStatus.mutate({ id, status: "SKIPPED" })}
            onReset={(id) => setOccurrenceStatus.mutate({ id, status: "PENDING" })}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {showAddModal && (
        <ChoreModal
          familyMembers={familyMembers}
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
