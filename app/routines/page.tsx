import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { FamilyMember } from "@prisma/client";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listRoutines, listRoutineOccurrences, type RoutineDTO, type RoutineOccurrenceDTO } from "@/lib/routines";
import RoutineBoard from "@/components/RoutineBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Routines",
};

async function getRoutinesData(ctx: FamilyContext): Promise<{
  familyMembers: FamilyMember[];
  routines: RoutineDTO[];
  occurrences: RoutineOccurrenceDTO[];
  holidayMode: boolean;
  error?: string;
}> {
  try {
    const [familyMembers, familyGroup, routines, occurrences] = await Promise.all([
      prisma.familyMember.findMany({
        where: { familyGroupId: ctx.familyGroupId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      prisma.familyGroup.findUniqueOrThrow({ where: { id: ctx.familyGroupId } }),
      listRoutines(ctx),
      listRoutineOccurrences(ctx),
    ]);
    // Force the same Date -> ISO string shape the client will see from fetch(), since
    // React Server Component props otherwise keep real Date instances (see app/calendar/page.tsx).
    return {
      familyMembers,
      routines: JSON.parse(JSON.stringify(routines)),
      occurrences: JSON.parse(JSON.stringify(occurrences)),
      holidayMode: familyGroup.holidayMode,
    };
  } catch {
    return {
      familyMembers: [],
      routines: [],
      occurrences: [],
      holidayMode: false,
      error: "Could not connect to database",
    };
  }
}

export default async function RoutinesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { familyMembers, routines, occurrences, holidayMode, error } = await getRoutinesData({
    user,
    familyGroupId: membership.familyGroupId,
  });

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-950 px-6 py-16">
      <Link
        href="/"
        className="mb-6 rounded-lg px-6 py-3 text-xl text-gray-400 hover:text-white"
      >
        ← Home
      </Link>
      <h1 className="text-3xl font-light tracking-widest text-white">Routines</h1>
      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
      {familyMembers.length === 0 && !error && (
        <p className="mt-10 text-xl text-gray-400">
          No family members yet — add one from the Home page to get started.
        </p>
      )}
      <div className="mt-10 w-full max-w-6xl px-4">
        <RoutineBoard
          initialRoutines={routines}
          initialOccurrences={occurrences}
          initialHolidayMode={holidayMode}
          familyMembers={familyMembers}
        />
      </div>
    </main>
  );
}
