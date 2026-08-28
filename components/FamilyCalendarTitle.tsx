"use client";

import { useState } from "react";

export default function FamilyCalendarTitle({
  initialName,
}: {
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  function handleStartEdit() {
    setInput(name);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setInput(name);
    setIsEditing(false);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      const res = await fetch("/api/family-group", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not save name. Please try again.");
        return;
      }
      setName(body.name);
      setIsEditing(false);
      setError(null);
    } catch {
      setError("Could not save name. Please try again.");
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col items-center gap-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Family surname"
          autoFocus
          className="w-72 rounded-lg bg-gray-800 px-4 py-3 text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-sm text-gray-500">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-5xl font-light tracking-widest text-white">
        {name} Family Calendar
      </p>
      <button
        type="button"
        onClick={handleStartEdit}
        className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
      >
        Edit Family Profile
      </button>
    </div>
  );
}
