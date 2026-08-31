import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-3xl font-light tracking-widest text-white">Settings</h1>
        <p className="mt-10 text-xl text-gray-400">Coming soon</p>
      </main>
      <Footer />
    </div>
  );
}
