"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyMember } from "@prisma/client";
import { FAMILY_MEMBER_COLORS, getFamilyMemberColor } from "@/lib/familyMemberColors";
import { FAMILY_MEMBER_AVATARS, getFamilyMemberAvatar } from "@/lib/familyMemberAvatars";

async function fetchFamilyMembers(): Promise<FamilyMember[]> {
  const res = await fetch("/api/family-members");
  if (!res.ok) throw new Error("Could not load family members");
  return res.json();
}

type EditableFields = { name: string; color: string; avatar: string };
type FamilyMemberPatch = Partial<EditableFields> & { active?: boolean };

export default function FamilyMemberManager({
  initialFamilyMembers,
  currentUserId,
}: {
  initialFamilyMembers: FamilyMember[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: familyMembers = [] } = useQuery({
    queryKey: ["family-members"],
    queryFn: fetchFamilyMembers,
    initialData: initialFamilyMembers,
  });

  const adults = familyMembers.filter((m) => m.role === "ADULT");
  const children = familyMembers.filter((m) => m.role === "CHILD");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(FAMILY_MEMBER_COLORS[0].key);
  const [newAvatar, setNewAvatar] = useState<string>(FAMILY_MEMBER_AVATARS[0].key);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editAvatar, setEditAvatar] = useState("");

  const addFamilyMember = useMutation({
    mutationFn: async ({ name, color, avatar }: EditableFields) => {
      const res = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, avatar }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add family member. Please try again.");
      return body as FamilyMember;
    },
    onSuccess: (member) => {
      queryClient.setQueryData<FamilyMember[]>(["family-members"], (prev = []) => [
        ...prev,
        member,
      ]);
      setNewName("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateFamilyMember = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & FamilyMemberPatch) => {
      const res = await fetch(`/api/family-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? "Could not update family member. Please try again.");
      return body as FamilyMember;
    },
    onSuccess: (member) => {
      queryClient.setQueryData<FamilyMember[]>(["family-members"], (prev = []) =>
        prev.map((m) => (m.id === member.id ? member : m))
      );
      setEditingId(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeFamilyMember = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/family-members/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onMutate: async (id) => {
      const previous = queryClient.getQueryData<FamilyMember[]>(["family-members"]) ?? [];
      queryClient.setQueryData<FamilyMember[]>(["family-members"], (prev = []) =>
        prev.filter((m) => m.id !== id)
      );
      return { previous };
    },
    onSuccess: () => setError(null),
    onError: (_err, _id, context) => {
      if (context) queryClient.setQueryData(["family-members"], context.previous);
      setError("Could not remove family member. Please try again.");
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    addFamilyMember.mutate({ name: newName, color: newColor, avatar: newAvatar });
  }

  function handleStartEdit(member: FamilyMember) {
    setEditingId(member.id);
    setEditName(member.name);
    setEditColor(member.color);
    setEditAvatar(member.avatar);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null || !editName.trim()) return;
    updateFamilyMember.mutate({ id: editingId, name: editName, color: editColor, avatar: editAvatar });
  }

  function handleRemove(id: number, name: string) {
    if (!window.confirm(`Remove ${name} and delete all their to-dos?`)) return;
    removeFamilyMember.mutate(id);
  }

  function handleToggleActive(member: FamilyMember) {
    updateFamilyMember.mutate({ id: member.id, active: !member.active });
  }

  function ColorPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
    return (
      <div className="flex flex-wrap gap-3">
        {FAMILY_MEMBER_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.label}
            onClick={() => onChange(c.key)}
            className={`h-12 w-12 rounded-full ${c.swatch} ${
              value === c.key ? "ring-4 ring-white" : ""
            }`}
          />
        ))}
      </div>
    );
  }

  function AvatarPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
    return (
      <div className="flex flex-wrap gap-3">
        {FAMILY_MEMBER_AVATARS.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-label={a.label}
            onClick={() => onChange(a.key)}
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-2xl ${
              value === a.key ? "ring-4 ring-white" : ""
            }`}
          >
            {a.emoji}
          </button>
        ))}
      </div>
    );
  }

  function EditForm() {
    return (
      <form
        onSubmit={handleSaveEdit}
        className="flex flex-col gap-4 rounded-xl bg-gray-900 p-6"
      >
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="rounded-lg bg-gray-800 px-4 py-3 text-xl text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <AvatarPicker value={editAvatar} onChange={setEditAvatar} />
        <ColorPicker value={editColor} onChange={setEditColor} />
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
    <div className="mx-auto w-full max-w-3xl">
      <h3 className="mb-4 text-center text-xl font-medium text-white">Adults</h3>
      <div className="flex flex-wrap justify-center gap-4">
        {adults.map((member) => {
          if (editingId === member.id) return <EditForm key={member.id} />;

          const color = getFamilyMemberColor(member.color);
          const avatar = getFamilyMemberAvatar(member.avatar);
          const isSelf = member.linkedUserId === currentUserId;

          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 rounded-full border-2 bg-gray-900 px-5 py-3 ${color.accent}`}
            >
              <span className="text-2xl">{avatar.emoji}</span>
              <span className="text-xl text-white">{member.name}</span>
              {isSelf && (
                <>
                  <span className="text-xs text-gray-500">You</span>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(member)}
                    className="rounded-lg px-4 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-4 mt-10 text-center text-xl font-medium text-white">Children</h3>
      <div className="flex flex-wrap justify-center gap-4">
        {children.map((member) => {
          if (editingId === member.id) return <EditForm key={member.id} />;

          const color = getFamilyMemberColor(member.color);
          const avatar = getFamilyMemberAvatar(member.avatar);

          if (!member.active) {
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-full border-2 border-gray-800 bg-gray-900/50 px-5 py-3 opacity-50"
              >
                <span className="text-2xl grayscale">{avatar.emoji}</span>
                <span className="text-xl text-gray-400">{member.name}</span>
                <span className="text-xs text-gray-500">Inactive</span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(member)}
                  className="rounded-lg px-4 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
                >
                  Reactivate
                </button>
              </div>
            );
          }

          return (
            <div
              key={member.id}
              className={`flex items-center gap-3 rounded-full border-2 bg-gray-900 px-5 py-3 ${color.accent}`}
            >
              <span className="text-2xl">{avatar.emoji}</span>
              <span className="text-xl text-white">{member.name}</span>
              <button
                type="button"
                onClick={() => handleStartEdit(member)}
                className="rounded-lg px-4 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleToggleActive(member)}
                className="rounded-lg px-4 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                Deactivate
              </button>
              <button
                type="button"
                onClick={() => handleRemove(member.id, member.name)}
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
        <h3 className="mb-4 text-2xl font-medium text-white">Add child</h3>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <div className="mt-4">
          <AvatarPicker value={newAvatar} onChange={setNewAvatar} />
        </div>
        <div className="mt-4">
          <ColorPicker value={newColor} onChange={setNewColor} />
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
