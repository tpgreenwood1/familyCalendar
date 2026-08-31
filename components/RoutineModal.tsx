"use client";

import { useState } from "react";
import type { FamilyMember } from "@prisma/client";
import type { RoutineDTO } from "@/lib/routines";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import { getFamilyMemberAvatar } from "@/lib/familyMemberAvatars";

export type RoutineFormPayload = {
  name: string;
  period: "MORNING" | "AFTERNOON" | "EVENING";
  familyMemberId: number;
  daysOfWeek: number[];
  activeDuringHoliday: boolean;
  items: string[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const PERIODS: { value: RoutineFormPayload["period"]; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
];

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

export default function RoutineModal({
  routine,
  familyMembers,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  routine?: RoutineDTO;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onCreate?: (payload: RoutineFormPayload) => Promise<boolean>;
  onUpdate?: (routineId: number, payload: RoutineFormPayload & { active: boolean }) => Promise<boolean>;
  onDelete?: (routineId: number) => Promise<boolean>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(routine?.name ?? "");
  const [period, setPeriod] = useState<RoutineFormPayload["period"]>(routine?.period ?? "MORNING");
  const [familyMemberId, setFamilyMemberId] = useState<number | null>(
    routine?.familyMemberId ?? familyMembers[0]?.id ?? null
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(routine?.daysOfWeek ?? EVERY_DAY);
  const [activeDuringHoliday, setActiveDuringHoliday] = useState(routine?.activeDuringHoliday ?? false);
  const [items, setItems] = useState<string[]>(
    routine && routine.items.length > 0 ? routine.items.map((i) => i.title) : [""]
  );
  const [active, setActive] = useState(routine?.active ?? true);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function updateItem(index: number, title: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? title : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (familyMemberId === null) {
      setError("Select who this routine is for");
      return;
    }
    if (daysOfWeek.length === 0) {
      setError("Select at least one day");
      return;
    }
    const trimmedItems = items.map((i) => i.trim()).filter(Boolean);
    if (trimmedItems.length === 0) {
      setError("Add at least one item");
      return;
    }

    const payload: RoutineFormPayload = {
      name: name.trim(),
      period,
      familyMemberId,
      daysOfWeek,
      activeDuringHoliday,
      items: trimmedItems,
    };

    setSaving(true);
    const success = routine
      ? ((await onUpdate?.(routine.id, { ...payload, active })) ?? false)
      : ((await onCreate?.(payload)) ?? false);
    setSaving(false);

    if (success) onClose();
    else setError("Could not save routine. Please try again.");
  }

  async function handleDelete() {
    if (!routine) return;
    if (!window.confirm(`Delete "${routine.name}"? This removes its whole history.`)) return;

    setSaving(true);
    const success = (await onDelete?.(routine.id)) ?? false;
    setSaving(false);

    if (success) onClose();
    else setError("Could not delete routine. Please try again.");
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h2 className="text-2xl font-medium text-white">{routine ? "Edit routine" : "Add routine"}</h2>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Routine (e.g. Morning)"
            autoFocus
            className="rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />

          <div>
            <p className="mb-2 text-sm text-gray-400">Period</p>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    period === p.value ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-gray-400">For</p>
            <div className="flex flex-wrap gap-2">
              {familyMembers.map((member) => {
                const color = getFamilyMemberColor(member.color);
                const avatar = getFamilyMemberAvatar(member.avatar);
                const selected = familyMemberId === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setFamilyMemberId(member.id)}
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

          <div>
            <p className="mb-2 text-sm text-gray-400">Applicable days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    daysOfWeek.includes(day)
                      ? "bg-gray-600 text-white"
                      : "bg-gray-800 text-gray-500 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => setDaysOfWeek(WEEKDAYS)}
                className={`rounded-lg px-3 py-1 ${
                  sameDays(daysOfWeek, WEEKDAYS) ? "text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setDaysOfWeek(WEEKENDS)}
                className={`rounded-lg px-3 py-1 ${
                  sameDays(daysOfWeek, WEEKENDS) ? "text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                Weekends
              </button>
              <button
                type="button"
                onClick={() => setDaysOfWeek(EVERY_DAY)}
                className={`rounded-lg px-3 py-1 ${
                  sameDays(daysOfWeek, EVERY_DAY) ? "text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                Every day
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={activeDuringHoliday}
              onChange={(e) => setActiveDuringHoliday(e.target.checked)}
              className="h-5 w-5 accent-gray-500"
            />
            Keep this routine during holiday mode
          </label>

          <div>
            <p className="mb-2 text-sm text-gray-400">Items</p>
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    placeholder="e.g. Get dressed"
                    className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 text-sm text-gray-400 hover:text-white"
            >
              + Add item
            </button>
          </div>

          {routine && (
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-5 w-5 accent-gray-500"
              />
              Active
            </label>
          )}

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
            >
              Save
            </button>
            {routine && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {error && <p className="text-sm text-gray-500">{error}</p>}
        </form>
      </div>
    </div>
  );
}
