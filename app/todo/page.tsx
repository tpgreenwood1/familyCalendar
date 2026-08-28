import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { FamilyUser, Todo } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TodoBoard from "@/components/TodoBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To Do",
};

async function getBoardData(familyGroupId: number): Promise<{
  todos: Todo[];
  familyUsers: FamilyUser[];
  error?: string;
}> {
  try {
    const [familyUsers, todos] = await Promise.all([
      prisma.familyUser.findMany({ where: { familyGroupId }, orderBy: { createdAt: "asc" } }),
      prisma.todo.findMany({
        where: { familyUser: { familyGroupId } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { familyUsers, todos };
  } catch {
    return { familyUsers: [], todos: [], error: "Could not connect to database" };
  }
}

export default async function TodoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { todos, familyUsers, error } = await getBoardData(session.user.familyGroupId);

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-950 px-6 py-16">
      <Link
        href="/"
        className="mb-6 rounded-lg px-6 py-3 text-xl text-gray-400 hover:text-white"
      >
        ← Home
      </Link>
      <h1 className="text-3xl font-light tracking-widest text-white">
        To Do
      </h1>
      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
      {familyUsers.length === 0 && !error && (
        <p className="mt-10 text-xl text-gray-400">
          No family members yet — add one from the Home page to get started.
        </p>
      )}
      <div className="mt-10 flex w-full max-w-full flex-col items-center px-4">
        <TodoBoard initialTodos={todos} familyUsers={familyUsers} />
      </div>
    </main>
  );
}
