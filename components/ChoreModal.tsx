"use client";

import { useState } from "react";
import type { FamilyMember } from "@prisma/client";
import type { ChoreDTO } from "@/lib/chores";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";
import { getFamilyMemberAvatar } from "@/lib/familyMemberAvatars";
import { PREDEFINED_CHORES } from "@/lib/predefinedChores";

const CUSTOM_TITLE = "__custom__";

export type ChoreFormPayload = {
  title: string;
  description?: string;
  familyMemberId: number;
  daysOfWeek: number[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

export default function ChoreModal({
  chore,
  familyMembers,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  chore?: ChoreDTO;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onCreate?: (payload: ChoreFormPayload) => Promise<boolean>;
  onUpdate?: (choreId: number, payload: ChoreFormPayload & { active: boolean }) => Promise<boolean>;
  onDelete?: (choreId: number) => Promise<boolean>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(chore?.title ?? PREDEFINED_CHORES[0]);
  const [useCustomTitle, setUseCustomTitle] = useState(!!chore);
  const [description, setDescription] = useState(chore?.description ?? "");
  const [familyMemberId, setFamilyMemberId] = useState<number | null>(
    chore?.familyMemberId ?? familyMembers[0]?.id ?? null
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(chore?.daysOfWeek ?? WEEKDAYS);
  const [active, setActive] = useState(chore?.active ?? true);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (familyMemberId === null) {
      setError("Select who this chore is assigned to");
      return;
    }
    if (daysOfWeek.length === 0) {
      setError("Select at least one day");
      return;
    }

    const payload: ChoreFormPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      familyMemberId,
      daysOfWeek,
    };

    setSaving(true);
    const success = chore
      ? ((await onUpdate?.(chore.id, { ...payload, active })) ?? false)
      : ((await onCreate?.(payload)) ?? false);
    setSaving(false);

    if (success) onClose();
    else setError("Could not save chore. Please try again.");
  }

  async function handleDelete() {
    if (!chore) return;
    if (!window.confirm(`Delete "${chore.title}"? This removes its whole history.`)) return;

    setSaving(true);
    const success = (await onDelete?.(chore.id)) ?? false;
    setSaving(false);

    if (success) onClose();
    else setError("Could not delete chore. Please try again.");
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
          <h2 className="text-2xl font-medium text-white">{chore ? "Edit chore" : "Add chore"}</h2>

          {!chore && !useCustomTitle && (
            <select
              value={title}
              onChange={(e) => {
                if (e.target.value === CUSTOM_TITLE) {
                  setUseCustomTitle(true);
                  setTitle("");
                } else {
                  setTitle(e.target.value);
                }
              }}
              className="rounded-lg bg-gray-800 px-4 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {PREDEFINED_CHORES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM_TITLE}>Custom…</option>
            </select>
          )}

          {(chore || useCustomTitle) && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chore (e.g. Empty dishwasher)"
              autoFocus
              className="rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          )}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="rounded-lg bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />

          <div>
            <p className="mb-2 text-sm text-gray-400">Assigned to</p>
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

          {chore && (
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
            {chore && (
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
