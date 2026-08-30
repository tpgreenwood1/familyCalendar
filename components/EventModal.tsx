"use client";

import { useState } from "react";
import type { FamilyMember } from "@prisma/client";
import type { CalendarOccurrenceDTO } from "@/lib/calendar";
import type { RecurrencePreset } from "@/lib/recurrence";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import { getFamilyMemberAvatar } from "@/lib/familyMemberAvatars";

export type EventFormPayload = {
  title: string;
  notes?: string;
  location?: string;
  participantIds: number[];
  recurrence: RecurrencePreset;
  recurrenceEndDate?: string;
} & (
  | { allDay: true; startDate: string; endDate: string }
  | { allDay: false; startAt: string; endAt: string }
);

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInput(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

const RECURRENCE_LABELS: Record<RecurrencePreset, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function EventModal({
  mode,
  occurrence,
  initialDate,
  familyMembers,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  mode: "create" | "detail";
  occurrence?: CalendarOccurrenceDTO;
  initialDate?: Date;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onCreate: (payload: EventFormPayload) => Promise<boolean>;
  onUpdate: (eventId: number, payload: EventFormPayload) => Promise<boolean>;
  onDelete: (eventId: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(mode === "create");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initialStart = occurrence ? new Date(occurrence.startAt) : initialDate ?? new Date();
  const initialEndSource = occurrence
    ? new Date(occurrence.endAt)
    : new Date(initialStart.getTime() + 60 * 60 * 1000);
  const initialInclusiveEndDate = occurrence?.allDay
    ? toDateInput(new Date(new Date(occurrence.endAt).getTime() - 24 * 60 * 60 * 1000))
    : toDateInput(initialStart);

  const [title, setTitle] = useState(occurrence?.title ?? "");
  const [allDay, setAllDay] = useState(occurrence?.allDay ?? false);
  const [date, setDate] = useState(toDateInput(initialStart));
  const [endDate, setEndDate] = useState(initialInclusiveEndDate);
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(toTimeInput(initialEndSource));
  const [location, setLocation] = useState(occurrence?.location ?? "");
  const [notes, setNotes] = useState(occurrence?.notes ?? "");
  const [participantIds, setParticipantIds] = useState<number[]>(
    occurrence?.participants.map((p) => p.id) ?? []
  );
  const [recurrence, setRecurrence] = useState<RecurrencePreset>(occurrence?.recurrence ?? "none");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    occurrence?.recurrenceEndDate ? toDateInput(new Date(occurrence.recurrenceEndDate)) : ""
  );

  function toggleParticipant(id: number) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function buildPayload(): EventFormPayload | null {
    if (!title.trim()) {
      setError("Title is required");
      return null;
    }
    if (participantIds.length === 0) {
      setError("Select at least one participant");
      return null;
    }

    const base = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
      participantIds,
      recurrence,
      recurrenceEndDate: recurrence !== "none" && recurrenceEndDate ? recurrenceEndDate : undefined,
    };

    if (allDay) {
      const finalEndDate = endDate || date;
      if (finalEndDate < date) {
        setError("End date must be on or after the start date");
        return null;
      }
      return { ...base, allDay: true, startDate: date, endDate: finalEndDate };
    }

    const startAt = new Date(`${date}T${startTime}`);
    const endAt = new Date(`${date}T${endTime}`);
    if (endAt <= startAt) {
      setError("End time must be after the start time");
      return null;
    }
    return { ...base, allDay: false, startAt: startAt.toISOString(), endAt: endAt.toISOString() };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    const success = occurrence
      ? await onUpdate(occurrence.eventId, payload)
      : await onCreate(payload);
    setSaving(false);

    if (success) onClose();
    else setError("Could not save event. Please try again.");
  }

  async function handleDelete() {
    if (!occurrence) return;
    const warning = occurrence.recurrence !== "none" ? " This removes the whole repeating series." : "";
    if (!window.confirm(`Delete "${occurrence.title}"?${warning}`)) return;

    setSaving(true);
    const success = await onDelete(occurrence.eventId);
    setSaving(false);

    if (success) onClose();
    else setError("Could not delete event. Please try again.");
  }

  function formatDetailDateTime(occ: CalendarOccurrenceDTO): string {
    const start = new Date(occ.startAt);
    const dateLabel = start.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (occ.allDay) return dateLabel;
    return `${dateLabel} ${toTimeInput(start)}-${toTimeInput(new Date(occ.endAt))}`;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!editing && occurrence ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-medium text-white">{occurrence.title}</h2>
            <p className="text-gray-300">{formatDetailDateTime(occurrence)}</p>

            <div className="flex flex-wrap gap-2">
              {occurrence.participants.map((p) => {
                const color = getFamilyMemberColor(p.color);
                const avatar = getFamilyMemberAvatar(p.avatar);
                return (
                  <span
                    key={p.id}
                    className={`flex items-center gap-2 rounded-full border-2 bg-gray-800 px-3 py-1 text-sm text-white ${color.accent}`}
                  >
                    <span>{avatar.emoji}</span>
                    {p.name}
                  </span>
                );
              })}
            </div>

            {occurrence.location && (
              <p className="text-gray-300">
                <span className="text-gray-500">Location: </span>
                {occurrence.location}
              </p>
            )}

            {occurrence.notes && (
              <div className="text-gray-300">
                <p className="text-gray-500">Notes:</p>
                <p className="whitespace-pre-wrap">{occurrence.notes}</p>
              </div>
            )}

            {occurrence.recurrence !== "none" && (
              <p className="text-sm text-gray-500">Repeats {RECURRENCE_LABELS[occurrence.recurrence].toLowerCase()}</p>
            )}

            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <h2 className="text-2xl font-medium text-white">
              {occurrence ? "Edit event" : "Add event"}
            </h2>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              className="rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />

            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-5 w-5 accent-gray-500"
              />
              All day
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-400">
                {allDay ? "Start date" : "Date"}
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </label>

              {allDay ? (
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  End date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </label>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    Start time
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-400">
                    End time
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                    />
                  </label>
                </>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-400">Participants</p>
              <div className="flex flex-wrap gap-2">
                {familyMembers.map((member) => {
                  const color = getFamilyMemberColor(member.color);
                  const avatar = getFamilyMemberAvatar(member.avatar);
                  const selected = participantIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleParticipant(member.id)}
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

            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="rounded-lg bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="rounded-lg bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-400">
                Repeats
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrencePreset)}
                  className="rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {(Object.keys(RECURRENCE_LABELS) as RecurrencePreset[]).map((key) => (
                    <option key={key} value={key}>
                      {RECURRENCE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              {recurrence !== "none" && (
                <label className="flex flex-col gap-1 text-sm text-gray-400">
                  Ends (optional)
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </label>
              )}
            </div>

            <div className="mt-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => (occurrence ? setEditing(false) : onClose())}
                className="rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-gray-500">{error}</p>}
      </div>
    </div>
  );
}
