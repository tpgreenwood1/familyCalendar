import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { getDashboardData } from "@/lib/dashboardData";
import WallDisplay from "@/components/WallDisplay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wall Display",
};

export default async function WallPage() {
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
    specialOccasions,
    screensaverSettings,
    error,
  } = await getDashboardData({ user, familyGroupId: membership.familyGroupId });

  return (
    <WallDisplay
      familyMembers={familyMembers}
      initialTodos={todos}
      initialChoreOccurrences={choreOccurrences}
      initialRoutineOccurrences={routineOccurrences}
      initialEvents={events}
      initialShoppingItems={shoppingItems}
      initialSpecialOccasions={specialOccasions}
      initialScreensaverSettings={screensaverSettings}
      loadError={error}
    />
  );
}
