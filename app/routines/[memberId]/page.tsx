import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listRoutineOccurrencesForWeek, type RoutineOccurrenceDTO } from "@/lib/routines";
import RoutineWeekOverview from "@/components/RoutineWeekOverview";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Weekly Routines",
};

async function getWeekData(ctx: FamilyContext): Promise<{
  weekStart: Date;
  occurrences: RoutineOccurrenceDTO[];
  error?: string;
}> {
  try {
    const { weekStart, occurrences } = await listRoutineOccurrencesForWeek(ctx);
    // Force the same Date -> ISO string shape the client will see from fetch(), since
    // React Server Component props otherwise keep real Date instances (see app/calendar/page.tsx).
    return JSON.parse(JSON.stringify({ weekStart, occurrences }));
  } catch {
    return { weekStart: new Date(), occurrences: [], error: "Could not connect to database" };
  }
}

export default async function RoutineWeekPage({
  params,
}: {
  params: { memberId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const memberId = Number(params.memberId);
  if (Number.isNaN(memberId)) notFound();

  const ctx: FamilyContext = { user, familyGroupId: membership.familyGroupId };

  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, familyGroupId: ctx.familyGroupId },
  });
  if (!member) redirect("/routines");

  const { weekStart, occurrences, error } = await getWeekData(ctx);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <Link
          href="/routines"
          className="mb-6 rounded-lg px-6 py-3 text-xl text-gray-400 hover:text-white"
        >
          ← Routines
        </Link>
        <h1 className="text-3xl font-light tracking-widest text-white">{member.name}&apos;s Week</h1>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        <div className="mt-10 w-full max-w-6xl px-4">
          <RoutineWeekOverview member={member} weekStart={weekStart} initialOccurrences={occurrences} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
