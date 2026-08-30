"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import type { CalendarOccurrenceDTO } from "@/lib/calendar";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import {
  addDays,
  getViewRange,
  multiDayColumnCount,
  shiftAnchor,
  type CalendarView,
} from "@/lib/calendarViewRange";
import CalendarGrid from "@/components/CalendarGrid";
import EventModal, { type EventFormPayload } from "@/components/EventModal";

async function fetchEvents(start: string, end: string): Promise<CalendarOccurrenceDTO[]> {
  const res = await fetch(
    `/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  );
  if (!res.ok) throw new Error("Could not load calendar events");
  return res.json();
}

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  multiday: "Multi-day",
  week: "Week",
};

function useMultiDayCount(): number {
  const [count, setCount] = useState(3);
  useEffect(() => {
    function update() {
      setCount(multiDayColumnCount(window.innerWidth));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
}

type ModalState =
  | { mode: "create"; initialDate: Date }
  | { mode: "detail"; occurrence: CalendarOccurrenceDTO }
  | null;

export default function CalendarBoard({
  initialEvents,
  familyMembers,
}: {
  initialEvents: CalendarOccurrenceDTO[];
  familyMembers: FamilyMember[];
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const multiDayCount = useMultiDayCount();
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = useMemo(
    () => getViewRange(view, anchorDate, multiDayCount),
    [view, anchorDate, multiDayCount]
  );
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const { data: occurrences = [] } = useQuery({
    queryKey: ["calendar-events", startISO, endISO],
    queryFn: () => fetchEvents(startISO, endISO),
    initialData: view === "week" ? initialEvents : undefined,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const days = useMemo(() => {
    const count = view === "week" ? 7 : view === "day" ? 1 : multiDayCount;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [start, view, multiDayCount]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  }

  const createEvent = useMutation({
    mutationFn: async (payload: EventFormPayload) => {
      const res = await fetch("/api/calendar/events", {
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
    onError: () => setError("Could not add event. Please try again."),
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: EventFormPayload }) => {
      const res = await fetch(`/api/calendar/events/${id}`, {
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
    onError: () => setError("Could not update event. Please try again."),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: () => setError("Could not delete event. Please try again."),
  });

  async function handleCreate(payload: EventFormPayload): Promise<boolean> {
    try {
      await createEvent.mutateAsync(payload);
      return true;
    } catch {
      return false;
    }
  }

  async function handleUpdate(id: number, payload: EventFormPayload): Promise<boolean> {
    try {
      await updateEvent.mutateAsync({ id, payload });
      return true;
    } catch {
      return false;
    }
  }

  async function handleDelete(id: number): Promise<boolean> {
    try {
      await deleteEvent.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  }

  function formatRangeLabel(): string {
    if (view === "day") {
      return start.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    }
    const last = addDays(end, -1);
    return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${last.toLocaleDateString(
      undefined,
      { day: "numeric", month: "short" }
    )}`;
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchorDate((d) => shiftAnchor(view, d, multiDayCount, -1))}
            className="rounded-lg px-4 py-2 text-xl text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate(new Date())}
            className="rounded-lg px-4 py-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchorDate((d) => shiftAnchor(view, d, multiDayCount, 1))}
            className="rounded-lg px-4 py-2 text-xl text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            →
          </button>
          <span className="ml-2 text-lg text-white">{formatRangeLabel()}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-gray-800 p-1">
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-lg px-4 py-2 text-sm ${
                  view === key ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {VIEW_LABELS[key]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setModal({ mode: "create", initialDate: new Date(anchorDate) })}
            disabled={familyMembers.length === 0}
            className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
          >
            + Add event
          </button>
        </div>
      </div>

      <CalendarGrid
        days={days}
        occurrences={occurrences}
        onSlotClick={(clicked) => setModal({ mode: "create", initialDate: clicked })}
        onEventClick={(occurrence) => setModal({ mode: "detail", occurrence })}
      />

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}

      {modal && (
        <EventModal
          mode={modal.mode}
          occurrence={modal.mode === "detail" ? modal.occurrence : undefined}
          initialDate={modal.mode === "create" ? modal.initialDate : undefined}
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
