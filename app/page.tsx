import Link from "next/link";
import { redirect } from "next/navigation";
import type { FamilyGroup, FamilyUser } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FamilyMemberManager from "@/components/FamilyMemberManager";
import FamilyCalendarTitle from "@/components/FamilyCalendarTitle";
import InviteCodeCard from "@/components/InviteCodeCard";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

async function getHomeData(familyGroupId: number): Promise<{
  familyGroup: FamilyGroup | null;
  familyUsers: FamilyUser[];
  error?: string;
}> {
  try {
    const [familyGroup, familyUsers] = await Promise.all([
      prisma.familyGroup.findUnique({ where: { id: familyGroupId } }),
      prisma.familyUser.findMany({ where: { familyGroupId }, orderBy: { createdAt: "asc" } }),
    ]);
    return { familyGroup, familyUsers };
  } catch {
    return { familyGroup: null, familyUsers: [], error: "Could not connect to database" };
  }
}

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");

  const { familyGroup, familyUsers, error } = await getHomeData(session.user.familyGroupId);

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-950 px-6 py-16">
      <FamilyCalendarTitle initialName={familyGroup?.name ?? "Family"} />
      {error && (
        <p className="mt-4 text-sm text-gray-500">{error}</p>
      )}

      <h2 className="mt-10 text-2xl font-light tracking-widest text-white">
        Features
      </h2>
      <div className="mt-6 flex flex-wrap justify-center gap-6">
        <Link
          href="/todo"
          className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
        >
          <span className="text-4xl">📋</span>
          <span className="text-xl font-medium">To Do</span>
        </Link>
        <div className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900/50 px-6 py-8 text-gray-500">
          <span className="text-4xl grayscale opacity-50">📅</span>
          <span className="text-xl font-medium">Family Calendar</span>
          <span className="text-xs text-gray-600">Coming soon</span>
        </div>
        <div className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900/50 px-6 py-8 text-gray-500">
          <span className="text-4xl grayscale opacity-50">🧹</span>
          <span className="text-xl font-medium">Chores</span>
          <span className="text-xs text-gray-600">Coming soon</span>
        </div>
        <div className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900/50 px-6 py-8 text-gray-500">
          <span className="text-4xl grayscale opacity-50">⏰</span>
          <span className="text-xl font-medium">Routines</span>
          <span className="text-xs text-gray-600">Coming soon</span>
        </div>
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
        <FamilyMemberManager initialFamilyUsers={familyUsers} />
      </div>

      {familyGroup && (
        <div className="mt-12">
          <InviteCodeCard inviteCode={familyGroup.inviteCode} />
        </div>
      )}

      <div className="mt-12">
        <LogoutButton />
      </div>
    </main>
  );
}
