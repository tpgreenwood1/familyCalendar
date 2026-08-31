import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { FamilyMember } from "@prisma/client";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listChores, type ChoreDTO } from "@/lib/chores";
import ChoreEditList from "@/components/ChoreEditList";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Chores",
};

async function getChoresEditData(ctx: FamilyContext): Promise<{
  familyMembers: FamilyMember[];
  chores: ChoreDTO[];
  error?: string;
}> {
  try {
    const familyMembers = await prisma.familyMember.findMany({
      where: { familyGroupId: ctx.familyGroupId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    const chores = await listChores(ctx);
    // Force the same Date -> ISO string shape the client will see from fetch(), since
    // React Server Component props otherwise keep real Date instances (see app/calendar/page.tsx).
    return { familyMembers, chores: JSON.parse(JSON.stringify(chores)) };
  } catch {
    return { familyMembers: [], chores: [], error: "Could not connect to database" };
  }
}

export default async function ChoresEditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { familyMembers, chores, error } = await getChoresEditData({
    user,
    familyGroupId: membership.familyGroupId,
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <Link
          href="/chores"
          className="mb-6 rounded-lg px-6 py-3 text-xl text-gray-400 hover:text-white"
        >
          ← Chores
        </Link>
        <h1 className="text-3xl font-light tracking-widest text-white">Edit Chores</h1>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        <div className="mt-10 w-full max-w-2xl px-4">
          <ChoreEditList initialChores={chores} familyMembers={familyMembers} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
