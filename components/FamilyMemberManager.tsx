"use client";

import { useState } from "react";
import type { FamilyUser } from "@prisma/client";
import { FAMILY_USER_COLORS, getFamilyUserColor } from "@/lib/familyUserColors";

export default function FamilyMemberManager({
  initialFamilyUsers,
}: {
  initialFamilyUsers: FamilyUser[];
}) {
  const [familyUsers, setFamilyUsers] = useState<FamilyUser[]>(initialFamilyUsers);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(FAMILY_USER_COLORS[0].key);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/family-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, color: newColor }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not add family member. Please try again.");
        return;
      }
      setFamilyUsers((prev) => [...prev, body]);
      setNewName("");
      setError(null);
    } catch {
      setError("Could not add family member. Please try again.");
    }
  }

  function handleStartEdit(user: FamilyUser) {
    setEditingId(user.id);
    setEditName(user.name);
    setEditColor(user.color);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null || !editName.trim()) return;

    try {
      const res = await fetch(`/api/family-users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, color: editColor }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not update family member. Please try again.");
        return;
      }
      setFamilyUsers((prev) => prev.map((u) => (u.id === editingId ? body : u)));
      setEditingId(null);
      setError(null);
    } catch {
      setError("Could not update family member. Please try again.");
    }
  }

  async function handleRemove(id: number, name: string) {
    if (!window.confirm(`Remove ${name} and delete all their to-dos?`)) return;

    const prevFamilyUsers = familyUsers;
    setFamilyUsers((prev) => prev.filter((u) => u.id !== id));

    try {
      const res = await fetch(`/api/family-users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setError(null);
    } catch {
      setFamilyUsers(prevFamilyUsers);
      setError("Could not remove family member. Please try again.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap justify-center gap-4">
        {familyUsers.map((user) => {
          const color = getFamilyUserColor(user.color);

          if (editingId === user.id) {
            return (
              <form
                key={user.id}
                onSubmit={handleSaveEdit}
                className="flex flex-col gap-4 rounded-xl bg-gray-900 p-6"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-lg bg-gray-800 px-4 py-3 text-xl text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                <div className="flex flex-wrap gap-3">
                  {FAMILY_USER_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-label={c.label}
                      onClick={() => setEditColor(c.key)}
                      className={`h-12 w-12 rounded-full ${c.swatch} ${
                        editColor === c.key ? "ring-4 ring-white" : ""
                      }`}
                    />
                  ))}
                </div>
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
              </form>
            );
          }

          return (
            <div
              key={user.id}
              className={`flex items-center gap-3 rounded-full border-2 bg-gray-900 px-5 py-3 ${color.accent}`}
            >
              <span className={`h-4 w-4 shrink-0 rounded-full ${color.swatch}`} />
              <span className="text-xl text-white">{user.name}</span>
              <button
                type="button"
                onClick={() => handleStartEdit(user)}
                className="rounded-lg px-4 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleRemove(user.id, user.name)}
                className="rounded-lg px-4 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleAdd}
        className="mx-auto mt-6 w-fit rounded-xl bg-gray-900 p-6"
      >
        <h3 className="mb-4 text-2xl font-medium text-white">Add family member</h3>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          {FAMILY_USER_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              onClick={() => setNewColor(c.key)}
              className={`h-12 w-12 rounded-full ${c.swatch} ${
                newColor === c.key ? "ring-4 ring-white" : ""
              }`}
            />
          ))}
        </div>
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
        >
          Add
        </button>
      </form>

      {error && <p className="mt-4 text-center text-sm text-gray-500">{error}</p>}
    </div>
  );
}
