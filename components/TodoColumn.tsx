"use client";

import { useState } from "react";
import type { FamilyUser, Todo } from "@prisma/client";
import { getFamilyUserColor } from "@/lib/familyUserColors";

export default function TodoColumn({
  user,
  todos,
  onAdd,
  onToggle,
  onDelete,
}: {
  user: FamilyUser;
  todos: Todo[];
  onAdd: (userId: number, text: string) => Promise<boolean>;
  onToggle: (id: number, completed: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [text, setText] = useState("");

  const color = getFamilyUserColor(user.color);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const success = await onAdd(user.id, text);
    if (success) setText("");
  }

  return (
    <div
      className={`w-80 shrink-0 rounded-xl border-t-4 bg-gray-900 p-6 ${color.accent}`}
    >
      <h2 className="mb-6 text-2xl font-medium text-white">{user.name}</h2>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a to-do..."
          className="min-w-0 flex-1 rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600"
        >
          Add
        </button>
      </form>

      <ul className="mt-4">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className="flex items-center gap-3 border-b border-gray-800 py-4"
          >
            <label className="flex flex-1 cursor-pointer items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={(e) => onToggle(todo.id, e.target.checked)}
                className="h-8 w-8 shrink-0 accent-gray-500"
              />
              <span
                className={
                  todo.completed
                    ? "text-base text-gray-500 line-through"
                    : "text-base text-white"
                }
              >
                {todo.text}
              </span>
            </label>
            <button
              type="button"
              onClick={() => onDelete(todo.id)}
              aria-label={`Remove "${todo.text}"`}
              className="shrink-0 rounded-lg px-4 py-3 text-base text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
