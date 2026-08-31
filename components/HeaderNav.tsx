"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/chores", label: "Chores" },
  { href: "/routines", label: "Routines" },
  { href: "/shopping", label: "Shopping" },
  { href: "/occasions", label: "Occasions" },
  { href: "/photos", label: "Photos" },
  { href: "/todo", label: "To Do" },
  { href: "/wall", label: "Wall" },
  { href: "/family", label: "Family" },
  { href: "/settings", label: "Settings" },
];

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? "font-medium text-white" : "text-gray-400 hover:text-white"}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
