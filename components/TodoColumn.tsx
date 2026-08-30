"use client";

import { useState } from "react";
import type { FamilyMember, Todo } from "@prisma/client";
import { getFamilyMemberColor } from "@/lib/familyMemberColors";

export default function TodoColumn({
  member,
  todos,
  onAdd,
  onEdit,
  onToggle,
  onTogglePriority,
  onDelete,
}: {
  member: FamilyMember;
  todos: Todo[];
  onAdd: (userId: number, text: string) => Promise<boolean>;
  onEdit: (id: number, text: string) => Promise<boolean>;
  onToggle: (id: number, completed: boolean) => void;
  onTogglePriority: (id: number, priority: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const color = getFamilyMemberColor(member.color);

  const active = todos
    .filter((t) => !t.completed)
    .sort((a, b) => Number(b.priority) - Number(a.priority));
  const completed = todos.filter((t) => t.completed);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const success = await onAdd(member.id, text);
    if (success) setText("");
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditText(todo.text);
  }

  async function commitEdit(todo: Todo) {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === todo.text) {
      setEditingId(null);
      return;
    }
    const success = await onEdit(todo.id, trimmed);
    if (success) setEditingId(null);
  }

  function renderTodo(todo: Todo) {
    const isEditing = editingId === todo.id;

    return (
      <li
        key={todo.id}
        className={`flex items-center gap-3 border-b border-gray-800 py-4 ${
          todo.priority && !todo.completed ? "-mx-3 rounded-lg border-b-0 bg-amber-500/10 px-3" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={(e) => onToggle(todo.id, e.target.checked)}
          className="h-8 w-8 shrink-0 accent-gray-500"
        />

        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => commitEdit(todo)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(todo);
              if (e.key === "Escape") setEditingId(null);
            }}
            className="min-w-0 flex-1 rounded-lg bg-gray-800 px-3 py-1 text-base text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => !todo.completed && startEdit(todo)}
            className={`flex-1 truncate text-left text-base ${
              todo.completed ? "text-gray-500 line-through" : "text-white"
            }`}
          >
            {todo.text}
          </button>
        )}

        {!todo.completed && (
          <button
            type="button"
            onClick={() => onTogglePriority(todo.id, !todo.priority)}
            aria-label={todo.priority ? `Unmark "${todo.text}" as priority` : `Mark "${todo.text}" as priority`}
            className={`shrink-0 rounded-lg px-2 py-1 text-xl ${
              todo.priority ? "text-amber-400" : "text-gray-600 hover:text-amber-400"
            }`}
          >
            {todo.priority ? "★" : "☆"}
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(todo.id)}
          aria-label={`Remove "${todo.text}"`}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          Remove
        </button>
      </li>
    );
  }

  return (
    <div
      className={`w-80 shrink-0 rounded-xl border-t-4 bg-gray-900 p-6 ${color.accent}`}
    >
      <h2 className="mb-6 text-2xl font-medium text-white">{member.name}</h2>

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

      <ul className="mt-4">{active.map(renderTodo)}</ul>

      {active.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">Nothing to do.</p>
      )}

      {completed.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            {showCompleted ? "Hide" : "Show"} completed ({completed.length})
          </button>
          {showCompleted && <ul className="mt-2">{completed.map(renderTodo)}</ul>}
        </div>
      )}
    </div>
  );
}
