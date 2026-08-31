import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Todo } from "@prisma/client";
import type { ChoreOccurrenceDTO } from "@/lib/chores";
import type { RoutineOccurrenceDTO } from "@/lib/routines";
import type { CalendarOccurrenceDTO } from "@/lib/calendar";
import { getViewRange } from "@/lib/calendarViewRange";
import { subscribeToFamilyEvents } from "@/lib/realtime";

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos");
  if (!res.ok) throw new Error("Could not load to-dos");
  return res.json();
}

async function fetchChoreOccurrences(): Promise<ChoreOccurrenceDTO[]> {
  const res = await fetch("/api/chores/occurrences");
  if (!res.ok) throw new Error("Could not load today's chores");
  return res.json();
}

async function fetchRoutineOccurrences(): Promise<RoutineOccurrenceDTO[]> {
  const res = await fetch("/api/routines/occurrences");
  if (!res.ok) throw new Error("Could not load today's routines");
  return res.json();
}

async function fetchTodayEvents(start: string, end: string): Promise<CalendarOccurrenceDTO[]> {
  const res = await fetch(
    `/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
  if (!res.ok) throw new Error("Could not load today's events");
  return res.json();
}

/**
 * Shared by `FamilyDashboard` (standard, Phase 9) and `WallDisplay` (Phase 10) — same
 * TanStack Query keys/mutations so both views' caches stay coherent regardless of which
 * one is mounted.
 */
export function useDashboardQueries({
  initialTodos,
  initialChoreOccurrences,
  initialRoutineOccurrences,
  initialEvents,
}: {
  initialTodos: Todo[];
  initialChoreOccurrences: ChoreOccurrenceDTO[];
  initialRoutineOccurrences: RoutineOccurrenceDTO[];
  initialEvents: CalendarOccurrenceDTO[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { start, end } = getViewRange("day", new Date(), 1);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const { data: todos = [] } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    initialData: initialTodos,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: choreOccurrences = [] } = useQuery({
    queryKey: ["chore-occurrences"],
    queryFn: fetchChoreOccurrences,
    initialData: initialChoreOccurrences,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: routineOccurrences = [] } = useQuery({
    queryKey: ["routine-occurrences"],
    queryFn: fetchRoutineOccurrences,
    initialData: initialRoutineOccurrences,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", startISO, endISO],
    queryFn: () => fetchTodayEvents(startISO, endISO),
    initialData: initialEvents,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const setChoreStatus = useMutation({
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

  const toggleRoutineItem = useMutation({
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

  const toggleTodo = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error();
    },
    onMutate: async ({ id, completed }) => {
      const previous = queryClient.getQueryData<Todo[]>(["todos"]) ?? [];
      queryClient.setQueryData<Todo[]>(["todos"], (prev = []) =>
        prev.map((t) => (t.id === id ? { ...t, completed } : t))
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(["todos"], context.previous);
      setError("Could not update to-do. Please try again.");
    },
  });

  return {
    todos,
    choreOccurrences,
    routineOccurrences,
    events,
    error,
    onCompleteChore: (id: number) => setChoreStatus.mutate({ id, status: "COMPLETED" }),
    onSkipChore: (id: number) => setChoreStatus.mutate({ id, status: "SKIPPED" }),
    onResetChore: (id: number) => setChoreStatus.mutate({ id, status: "PENDING" }),
    onToggleRoutineItem: (occurrenceId: number, itemId: number, completed: boolean) =>
      toggleRoutineItem.mutate({ occurrenceId, itemId, completed }),
    onToggleTodo: (id: number, completed: boolean) => toggleTodo.mutate({ id, completed }),
  };
}
