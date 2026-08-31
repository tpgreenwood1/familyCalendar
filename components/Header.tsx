import Link from "next/link";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import HeaderNav from "@/components/HeaderNav";
import LogoutButton from "@/components/LogoutButton";

async function getFamilyName(): Promise<string> {
  try {
    const user = await getCurrentUser();
    if (!user) return "Family";

    const membership = await getFamilyMembership(user.id);
    if (!membership) return "Family";

    const familyGroup = await prisma.familyGroup.findUnique({
      where: { id: membership.familyGroupId },
    });
    return familyGroup?.name ?? "Family";
  } catch {
    return "Family";
  }
}

export default async function Header() {
  const familyName = await getFamilyName();

  return (
    <header className="flex w-full flex-wrap items-center justify-between gap-4 border-b border-gray-800 px-6 py-4">
      <Link
        href="/"
        className="text-xl font-light tracking-widest text-white hover:text-gray-300"
      >
        {familyName} Family Calendar
      </Link>
      <HeaderNav />
      <LogoutButton />
    </header>
  );
}
