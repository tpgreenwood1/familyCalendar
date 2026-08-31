import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { FamilyMember } from "@prisma/client";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listEventsInRange, type CalendarOccurrenceDTO } from "@/lib/calendar";
import { getViewRange } from "@/lib/calendarViewRange";
import CalendarBoard from "@/components/CalendarBoard";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar",
};

async function getCalendarData(ctx: FamilyContext): Promise<{
  familyMembers: FamilyMember[];
  events: CalendarOccurrenceDTO[];
  error?: string;
}> {
  try {
    const familyMembers = await prisma.familyMember.findMany({
      where: { familyGroupId: ctx.familyGroupId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    const { start, end } = getViewRange("week", new Date(), 3);
    const occurrences = await listEventsInRange(ctx, start, end);
    // Force the same Date -> ISO string shape the client will see from fetch(),
    // since React Server Component props otherwise keep real Date instances.
    const events = JSON.parse(JSON.stringify(occurrences)) as CalendarOccurrenceDTO[];
    return { familyMembers, events };
  } catch {
    return { familyMembers: [], events: [], error: "Could not connect to database" };
  }
}

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { familyMembers, events, error } = await getCalendarData({
    user,
    familyGroupId: membership.familyGroupId,
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-3xl font-light tracking-widest text-white">Calendar</h1>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        {familyMembers.length === 0 && !error && (
          <p className="mt-10 text-xl text-gray-400">
            No family members yet — add one from the Family page to get started.
          </p>
        )}
        <div className="mt-10 w-full max-w-6xl px-4">
          <CalendarBoard initialEvents={events} familyMembers={familyMembers} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
