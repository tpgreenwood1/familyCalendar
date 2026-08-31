"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import type { SpecialOccasionDTO } from "@/lib/specialOccasions";
import SpecialOccasionModal, { type SpecialOccasionFormPayload } from "@/components/SpecialOccasionModal";

export const SPECIAL_OCCASIONS_QUERY_KEY = ["special-occasions"];
const QUERY_KEY = SPECIAL_OCCASIONS_QUERY_KEY;

export async function fetchSpecialOccasions(): Promise<SpecialOccasionDTO[]> {
  const res = await fetch("/api/special-occasions");
  if (!res.ok) throw new Error("Could not load special occasions");
  return res.json();
}

function occasionIcon(occasion: SpecialOccasionDTO): string {
  if (occasion.isSomber) return "🕊️";
  return occasion.type === "BIRTHDAY" ? "🎂" : "💍";
}

function occasionSubtitle(occasion: SpecialOccasionDTO): string {
  const { isToday, isSomber, daysUntil, computedYears, type } = occasion;
  if (isToday && isSomber) {
    return `Today marks ${computedYears} years since ${occasion.title}`;
  }
  if (isToday) {
    return type === "BIRTHDAY"
      ? `It's ${occasion.title} today! (turning ${computedYears})`
      : `It's ${occasion.title} today! (${computedYears} years)`;
  }
  return type === "BIRTHDAY"
    ? `in ${daysUntil} days · turning ${computedYears}`
    : `in ${daysUntil} days · ${computedYears} years`;
}

export default function SpecialOccasionList({
  initialOccasions,
}: {
  initialOccasions: SpecialOccasionDTO[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOccasion, setEditingOccasion] = useState<SpecialOccasionDTO | null>(null);

  const { data: occasions = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSpecialOccasions,
    initialData: initialOccasions,
    refetchInterval: subscribeToFamilyEvents(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  const createOccasion = useMutation({
    mutationFn: async (payload: SpecialOccasionFormPayload) => {
      const res = await fetch("/api/special-occasions", {
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
    onError: () => setError("Could not add occasion. Please try again."),
  });

  const updateOccasion = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: SpecialOccasionFormPayload }) => {
      const res = await fetch(`/api/special-occasions/${id}`, {
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
    onError: () => setError("Could not update occasion. Please try again."),
  });

  const deleteOccasion = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/special-occasions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not delete occasion. Please try again."),
  });

  async function handleCreate(payload: SpecialOccasionFormPayload): Promise<boolean> {
    try {
      await createOccasion.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }

  async function handleUpdate(id: number, payload: SpecialOccasionFormPayload): Promise<boolean> {
    try {
      await updateOccasion.mutateAsync({ id, payload });
      return true;
    } catch {
      return false;
    }
  }

  async function handleDelete(id: number): Promise<boolean> {
    try {
      await deleteOccasion.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  }

  function openCreate() {
    setEditingOccasion(null);
    setModalOpen(true);
  }

  function openEdit(occasion: SpecialOccasionDTO) {
    setEditingOccasion(occasion);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-medium text-white">Special Occasions</h2>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600"
        >
          + Add occasion
        </button>
      </div>

      {occasions.length === 0 && (
        <p className="text-sm text-gray-500">No special occasions yet — add a birthday or anniversary.</p>
      )}

      <ul>
        {occasions.map((occasion) => (
          <li key={occasion.id} className="border-b border-gray-800 py-4">
            <button
              type="button"
              onClick={() => openEdit(occasion)}
              className="flex w-full items-center gap-4 text-left"
            >
              <span className="text-3xl">{occasionIcon(occasion)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg text-white">{occasion.title}</span>
                <span className="block text-sm text-gray-500">{occasionSubtitle(occasion)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {modalOpen && (
        <SpecialOccasionModal
          occasion={editingOccasion ?? undefined}
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
