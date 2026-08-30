import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { listShoppingItems, type ShoppingItemDTO } from "@/lib/shopping";
import ShoppingList from "@/components/ShoppingList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopping",
};

async function getShoppingData(ctx: FamilyContext): Promise<{
  items: ShoppingItemDTO[];
  error?: string;
}> {
  try {
    const items = await listShoppingItems(ctx);
    // Force the same Date -> ISO string shape the client will see from fetch(), since
    // React Server Component props otherwise keep real Date instances (see app/chores/page.tsx).
    return { items: JSON.parse(JSON.stringify(items)) };
  } catch {
    return { items: [], error: "Could not connect to database" };
  }
}

export default async function ShoppingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { items, error } = await getShoppingData({
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
      <h1 className="text-3xl font-light tracking-widest text-white">Shopping List</h1>
      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
      <div className="mt-10 w-full px-4">
        <ShoppingList initialItems={items} />
      </div>
    </main>
  );
}
