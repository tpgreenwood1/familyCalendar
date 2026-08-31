import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { getDashboardData } from "@/lib/dashboardData";
import FamilyDashboard from "@/components/FamilyDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const {
    familyMembers,
    todos,
    choreOccurrences,
    routineOccurrences,
    events,
    shoppingItems,
    error,
  } = await getDashboardData({ user, familyGroupId: membership.familyGroupId });

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-950 px-6 py-16">
      <Link
        href="/"
        className="mb-6 rounded-lg px-6 py-3 text-xl text-gray-400 hover:text-white"
      >
        ← Home
      </Link>
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-light tracking-widest text-white">Dashboard</h1>
        <Link
          href="/wall"
          className="rounded-full border border-gray-700 px-4 py-1.5 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
        >
          Wall Display →
        </Link>
      </div>
      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
      {familyMembers.length === 0 && !error && (
        <p className="mt-10 text-xl text-gray-400">
          No family members yet — add one from the Home page to get started.
        </p>
      )}
      <div className="mt-10 w-full max-w-6xl px-4">
        <FamilyDashboard
          familyMembers={familyMembers}
          initialTodos={todos}
          initialChoreOccurrences={choreOccurrences}
          initialRoutineOccurrences={routineOccurrences}
          initialEvents={events}
          initialShoppingItems={shoppingItems}
        />
      </div>
    </main>
  );
}
