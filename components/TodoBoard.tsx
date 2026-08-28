"use client";

import { useState } from "react";
import type { FamilyUser, Todo } from "@prisma/client";
import TodoColumn from "@/components/TodoColumn";

export default function TodoBoard({
  initialTodos,
  familyUsers,
}: {
  initialTodos: Todo[];
  familyUsers: FamilyUser[];
}) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [error, setError] = useState<string | null>(null);

  async function handleAddTodo(userId: number, text: string): Promise<boolean> {
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, userId }),
      });
      if (!res.ok) throw new Error();
      const todo: Todo = await res.json();
      setTodos((prev) => [...prev, todo]);
      setError(null);
      return true;
    } catch {
      setError("Could not add item. Please try again.");
      return false;
    }
  }

  async function handleToggleTodo(id: number, completed: boolean) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error();
      setError(null);
    } catch {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
      );
      setError("Could not update item. Please try again.");
    }
  }

  async function handleDeleteTodo(id: number) {
    const prevTodos = todos;
    setTodos((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setError(null);
    } catch {
      setTodos(prevTodos);
      setError("Could not delete item. Please try again.");
    }
  }

  return (
    <div className="w-full">
      <div className="flex w-full gap-6 overflow-x-auto pb-4">
        {familyUsers.map((user) => (
          <TodoColumn
            key={user.id}
            user={user}
            todos={todos.filter((t) => t.userId === user.id)}
            onAdd={handleAddTodo}
            onToggle={handleToggleTodo}
            onDelete={handleDeleteTodo}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
    </div>
  );
}
