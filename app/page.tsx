import Link from "next/link";
import { redirect } from "next/navigation";
import type { FamilyGroup, FamilyMember } from "@prisma/client";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import FamilyMemberManager from "@/components/FamilyMemberManager";
import FamilyCalendarTitle from "@/components/FamilyCalendarTitle";
import InviteCodeCard from "@/components/InviteCodeCard";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

async function getHomeData(familyGroupId: number): Promise<{
  familyGroup: FamilyGroup | null;
  familyMembers: FamilyMember[];
  error?: string;
}> {
  try {
    const [familyGroup, familyMembers] = await Promise.all([
      prisma.familyGroup.findUnique({ where: { id: familyGroupId } }),
      prisma.familyMember.findMany({
        where: { familyGroupId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    return { familyGroup, familyMembers };
  } catch {
    return { familyGroup: null, familyMembers: [], error: "Could not connect to database" };
  }
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { familyGroup, familyMembers, error } = await getHomeData(membership.familyGroupId);

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-950 px-6 py-16">
      <h2 className="text-2xl font-light tracking-widest text-white">
        Family Settings
      </h2>
      <div className="mt-6">
        <FamilyCalendarTitle initialName={familyGroup?.name ?? "Family"} />
      </div>
      {error && (
        <p className="mt-4 text-sm text-gray-500">{error}</p>
      )}
      {familyGroup && (
        <div className="mt-8">
          <InviteCodeCard />
        </div>
      )}

      <h2 className="mt-12 text-2xl font-light tracking-widest text-white">
        Features
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-6">
        <Link
          href="/dashboard"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">🏠</span>
          <span className="text-xl font-medium">Dashboard</span>
        </Link>
        <Link
          href="/todo"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">📋</span>
          <span className="text-xl font-medium">To Do</span>
        </Link>
        <Link
          href="/calendar"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">📅</span>
          <span className="text-xl font-medium">Family Calendar</span>
        </Link>
        <Link
          href="/chores"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">🧹</span>
          <span className="text-xl font-medium">Chores</span>
        </Link>
        <Link
          href="/routines"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">⏰</span>
          <span className="text-xl font-medium">Routines</span>
        </Link>
        <Link
          href="/shopping"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">🛒</span>
          <span className="text-xl font-medium">Shopping List</span>
        </Link>
        <Link
          href="/wall"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">🖥️</span>
          <span className="text-xl font-medium">Wall Display</span>
        </Link>
        <div className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900/50 px-6 py-8 text-gray-500">
          <span className="text-4xl grayscale opacity-50">📷</span>
          <span className="text-xl font-medium">Photos</span>
          <span className="text-xs text-gray-600">Coming soon</span>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-light tracking-widest text-white">
        Family Members
      </h2>
      <div className="mt-6 w-full">
        <FamilyMemberManager initialFamilyMembers={familyMembers} currentUserId={user.id} />
      </div>

      <div className="mt-12">
        <LogoutButton />
      </div>
    </main>
  );
}
