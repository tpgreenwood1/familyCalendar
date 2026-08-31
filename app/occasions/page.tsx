import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { listSpecialOccasions, type SpecialOccasionDTO } from "@/lib/specialOccasions";
import SpecialOccasionList from "@/components/SpecialOccasionList";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Special Occasions",
};

async function getOccasionsData(
  ctx: FamilyContext
): Promise<{ occasions: SpecialOccasionDTO[]; error?: string }> {
  try {
    const occasions = await listSpecialOccasions(ctx);
    // Force the same Date -> ISO string shape the client will see from fetch(), since
    // React Server Component props otherwise keep real Date instances (see app/calendar/page.tsx).
    return { occasions: JSON.parse(JSON.stringify(occasions)) };
  } catch {
    return { occasions: [], error: "Could not connect to database" };
  }
}

export default async function OccasionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { occasions, error } = await getOccasionsData({
    user,
    familyGroupId: membership.familyGroupId,
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-3xl font-light tracking-widest text-white">Special Occasions</h1>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        <div className="mt-10 w-full max-w-6xl px-4">
          <SpecialOccasionList initialOccasions={occasions} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
