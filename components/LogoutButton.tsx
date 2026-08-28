"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
    >
      Log Out
    </button>
  );
}
