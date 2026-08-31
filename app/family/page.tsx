import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { FamilyGroup, FamilyMember } from "@prisma/client";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FamilyMemberManager from "@/components/FamilyMemberManager";
import FamilyCalendarTitle from "@/components/FamilyCalendarTitle";
import InviteCodeCard from "@/components/InviteCodeCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Family",
};

async function getFamilyData(familyGroupId: number): Promise<{
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

export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { familyGroup, familyMembers, error } = await getFamilyData(membership.familyGroupId);

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-3xl font-light tracking-widest text-white">Family</h1>
        <div className="mt-6">
          <FamilyCalendarTitle initialName={familyGroup?.name ?? "Family"} />
        </div>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        {familyGroup && (
          <div className="mt-8">
            <InviteCodeCard />
          </div>
        )}

        <h2 className="mt-12 text-2xl font-light tracking-widest text-white">
          Family Members
        </h2>
        <div className="mt-6 w-full">
          <FamilyMemberManager initialFamilyMembers={familyMembers} currentUserId={user.id} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
