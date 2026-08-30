"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember, Todo } from "@prisma/client";
import TodoColumn from "@/components/TodoColumn";
import { subscribeToFamilyEvents } from "@/lib/realtime";

type TodoPatch = { text?: string; completed?: boolean; priority?: boolean };

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos");
  if (!res.ok) throw new Error("Could not load to-dos");
  return res.json();
}

export default function TodoBoard({
  initialTodos,
  familyMembers,
}: {
  initialTodos: Todo[];
  familyMembers: FamilyMember[];
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: todos = [] } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    initialData: initialTodos,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const addTodo = useMutation({
    mutationFn: async ({ userId, text }: { userId: number; text: string }) => {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, userId }),
      });
      if (!res.ok) throw new Error();
      return (await res.json()) as Todo;
    },
    onSuccess: (todo) => {
      queryClient.setQueryData<Todo[]>(["todos"], (prev = []) => [...prev, todo]);
      setError(null);
    },
    onError: () => setError("Could not add item. Please try again."),
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: TodoPatch }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    },
    onMutate: async ({ id, patch }) => {
      const previous = queryClient.getQueryData<Todo[]>(["todos"]) ?? [];
      queryClient.setQueryData<Todo[]>(["todos"], (prev = []) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(["todos"], context.previous);
      setError("Could not update item. Please try again.");
    },
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onMutate: async (id) => {
      const previous = queryClient.getQueryData<Todo[]>(["todos"]) ?? [];
      queryClient.setQueryData<Todo[]>(["todos"], (prev = []) =>
        prev.filter((t) => t.id !== id)
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _id, context) => {
      if (context) queryClient.setQueryData(["todos"], context.previous);
      setError("Could not delete item. Please try again.");
    },
  });

  async function handleAddTodo(userId: number, text: string): Promise<boolean> {
    try {
      await addTodo.mutateAsync({ userId, text });
      return true;
    } catch {
      return false;
    }
  }

  async function handleEditTodo(id: number, text: string): Promise<boolean> {
    try {
      await updateTodo.mutateAsync({ id, patch: { text } });
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div className="w-full">
      <div className="flex w-full gap-6 overflow-x-auto pb-4">
        {familyMembers.map((member) => (
          <TodoColumn
            key={member.id}
            member={member}
            todos={todos.filter((t) => t.userId === member.id)}
            onAdd={handleAddTodo}
            onEdit={handleEditTodo}
            onToggle={(id, completed) => updateTodo.mutate({ id, patch: { completed } })}
            onTogglePriority={(id, priority) => updateTodo.mutate({ id, patch: { priority } })}
            onDelete={(id) => deleteTodo.mutate(id)}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
    </div>
  );
}
