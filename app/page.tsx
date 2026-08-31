import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership } from "@/lib/authz";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClockWidget from "@/components/ClockWidget";
import WeatherWidget from "@/components/WeatherWidget";

export const dynamic = "force-dynamic";

const TILES = [
  { href: "/dashboard", icon: "🏠", label: "Dashboard" },
  { href: "/todo", icon: "📋", label: "To Do" },
  { href: "/calendar", icon: "📅", label: "Family Calendar" },
  { href: "/chores", icon: "🧹", label: "Chores" },
  { href: "/routines", icon: "⏰", label: "Routines" },
  { href: "/shopping", icon: "🛒", label: "Shopping List" },
  { href: "/occasions", icon: "🎂", label: "Special Occasions" },
  { href: "/photos", icon: "📷", label: "Photos" },
  { href: "/wall", icon: "🖥️", label: "Wall Display" },
  { href: "/family", icon: "👪", label: "Family" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <ClockWidget />
        <div className="mt-6">
          <WeatherWidget />
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-6">
          {TILES.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex w-56 flex-col items-center gap-3 rounded-2xl bg-gray-900 px-6 py-8 text-white hover:bg-gray-800"
            >
              <span className="text-4xl">{tile.icon}</span>
              <span className="text-xl font-medium">{tile.label}</span>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
