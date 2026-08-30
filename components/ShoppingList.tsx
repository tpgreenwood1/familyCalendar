"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import type { ShoppingItemDTO } from "@/lib/shopping";

const QUERY_KEY = ["shopping-items"];

async function fetchShoppingItems(): Promise<ShoppingItemDTO[]> {
  const res = await fetch("/api/shopping/items");
  if (!res.ok) throw new Error("Could not load shopping list");
  return res.json();
}

export default function ShoppingList({ initialItems }: { initialItems: ShoppingItemDTO[] }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showChecked, setShowChecked] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchShoppingItems,
    initialData: initialItems,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const addItem = useMutation({
    mutationFn: async (itemName: string) => {
      const res = await fetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: itemName }),
      });
      if (!res.ok) throw new Error();
      return (await res.json()) as ShoppingItemDTO;
    },
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingItemDTO[]>(QUERY_KEY, (prev = []) => [...prev, item]);
      setError(null);
    },
    onError: () => setError("Could not add item. Please try again."),
  });

  const setChecked = useMutation({
    mutationFn: async ({ id, checked }: { id: number; checked: boolean }) => {
      const res = await fetch(`/api/shopping/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      });
      if (!res.ok) throw new Error();
    },
    onMutate: async ({ id, checked }) => {
      const previous = queryClient.getQueryData<ShoppingItemDTO[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<ShoppingItemDTO[]>(QUERY_KEY, (prev = []) =>
        prev.map((i) => (i.id === id ? { ...i, checked } : i))
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(QUERY_KEY, context.previous);
      setError("Could not update item. Please try again.");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/shopping/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onMutate: async (id) => {
      const previous = queryClient.getQueryData<ShoppingItemDTO[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<ShoppingItemDTO[]>(QUERY_KEY, (prev = []) =>
        prev.filter((i) => i.id !== id)
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _id, context) => {
      if (context) queryClient.setQueryData(QUERY_KEY, context.previous);
      setError("Could not delete item. Please try again.");
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addItem.mutate(trimmed);
    setName("");
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  function renderItem(item: ShoppingItemDTO) {
    return (
      <li key={item.id} className="flex items-center gap-3 border-b border-gray-800 py-4">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(e) => setChecked.mutate({ id: item.id, checked: e.target.checked })}
          className="h-8 w-8 shrink-0 accent-gray-500"
        />
        <span
          className={`flex-1 truncate text-lg ${
            item.checked ? "text-gray-500 line-through" : "text-white"
          }`}
        >
          {item.name}
        </span>
        <button
          type="button"
          onClick={() => deleteItem.mutate(item.id)}
          aria-label={`Remove "${item.name}"`}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          Remove
        </button>
      </li>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-xl border-t-4 border-emerald-500 bg-gray-900 p-6">
      <h2 className="mb-6 text-2xl font-medium text-white">Groceries</h2>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an item..."
          className="min-w-0 flex-1 rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600"
        >
          Add
        </button>
      </form>

      <ul className="mt-4">{unchecked.map(renderItem)}</ul>

      {unchecked.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">Nothing on the list.</p>
      )}

      {checked.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowChecked((v) => !v)}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            {showChecked ? "Hide" : "Show"} checked off ({checked.length})
          </button>
          {showChecked && <ul className="mt-2">{checked.map(renderItem)}</ul>}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
    </div>
  );
}
