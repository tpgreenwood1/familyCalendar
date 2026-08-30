import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import FamilySetupForm from "@/components/FamilySetupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join or Create a Family",
};

// Recovery path for DesignSpec.md §6.1's account/family split: a signed-in user with no
// FamilyMembership yet (normally only reached if the family-setup call during signup
// failed after the account was already created — see components/LoginForm.tsx).
export default async function FamilySetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (membership) redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 py-16">
      <FamilySetupForm />
    </main>
  );
}
