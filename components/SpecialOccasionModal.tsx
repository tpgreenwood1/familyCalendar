"use client";

import { useState } from "react";
import type { SpecialOccasionDTO } from "@/lib/specialOccasions";

export type SpecialOccasionFormPayload = {
  title: string;
  type: "BIRTHDAY" | "ANNIVERSARY";
  originalDate: string;
  isSomber: boolean;
};

function toDateInputValue(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export default function SpecialOccasionModal({
  occasion,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  occasion?: SpecialOccasionDTO;
  onClose: () => void;
  onCreate?: (payload: SpecialOccasionFormPayload) => Promise<boolean>;
  onUpdate?: (id: number, payload: SpecialOccasionFormPayload) => Promise<boolean>;
  onDelete?: (id: number) => Promise<boolean>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(occasion?.title ?? "");
  const [type, setType] = useState<"BIRTHDAY" | "ANNIVERSARY">(occasion?.type ?? "BIRTHDAY");
  const [originalDate, setOriginalDate] = useState(
    occasion ? toDateInputValue(occasion.originalDate) : ""
  );
  const [isSomber, setIsSomber] = useState(occasion?.isSomber ?? false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!originalDate) {
      setError("Date is required");
      return;
    }

    const payload: SpecialOccasionFormPayload = {
      title: title.trim(),
      type,
      originalDate,
      isSomber,
    };

    setSaving(true);
    const success = occasion
      ? ((await onUpdate?.(occasion.id, payload)) ?? false)
      : ((await onCreate?.(payload)) ?? false);
    setSaving(false);

    if (success) onClose();
    else setError("Could not save occasion. Please try again.");
  }

  async function handleDelete() {
    if (!occasion) return;
    if (!window.confirm(`Delete "${occasion.title}"?`)) return;

    setSaving(true);
    const success = (await onDelete?.(occasion.id)) ?? false;
    setSaving(false);

    if (success) onClose();
    else setError("Could not delete occasion. Please try again.");
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
          <h2 className="text-2xl font-medium text-white">
            {occasion ? "Edit occasion" : "Add occasion"}
          </h2>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Mum's Birthday)"
            autoFocus
            className="rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />

          <div>
            <p className="mb-2 text-sm text-gray-400">Type</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("BIRTHDAY")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  type === "BIRTHDAY" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white"
                }`}
              >
                🎂 Birthday
              </button>
              <button
                type="button"
                onClick={() => setType("ANNIVERSARY")}
                className={`rounded-lg px-4 py-2 text-sm ${
                  type === "ANNIVERSARY" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white"
                }`}
              >
                💍 Anniversary
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-gray-400">Date</p>
            <input
              type="date"
              value={originalDate}
              onChange={(e) => setOriginalDate(e.target.value)}
              className="rounded-lg bg-gray-800 px-4 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use the birth year (birthdays) or the year the event happened (anniversaries) — it&apos;s used to work out the age/years count.
            </p>
          </div>

          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              checked={isSomber}
              onChange={(e) => setIsSomber(e.target.checked)}
              className="h-5 w-5 accent-gray-500"
            />
            Somber occasion (e.g. In Memory of…)
          </label>

          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
            >
              Save
            </button>
            {occasion && (
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
