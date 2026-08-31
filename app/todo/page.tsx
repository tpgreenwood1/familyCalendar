import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { FamilyMember, Todo } from "@prisma/client";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import TodoBoard from "@/components/TodoBoard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To Do",
};

async function getBoardData(familyGroupId: number): Promise<{
  todos: Todo[];
  familyMembers: FamilyMember[];
  error?: string;
}> {
  try {
    const [familyMembers, todos] = await Promise.all([
      prisma.familyMember.findMany({ where: { familyGroupId }, orderBy: { createdAt: "asc" } }),
      prisma.todo.findMany({
        where: { familyMember: { familyGroupId } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { familyMembers, todos };
  } catch {
    return { familyMembers: [], todos: [], error: "Could not connect to database" };
  }
}

export default async function TodoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { todos, familyMembers, error } = await getBoardData(membership.familyGroupId);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-3xl font-light tracking-widest text-white">
          To Do
        </h1>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        {familyMembers.length === 0 && !error && (
          <p className="mt-10 text-xl text-gray-400">
            No family members yet — add one from the Family page to get started.
          </p>
        )}
        <div className="mt-10 flex w-full max-w-full flex-col items-center px-4">
          <TodoBoard initialTodos={todos} familyMembers={familyMembers} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
