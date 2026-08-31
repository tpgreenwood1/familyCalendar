"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        authClient.signOut({
          fetchOptions: { onSuccess: () => router.push("/login") },
        })
      }
      className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
    >
      Log Out
    </button>
  );
}
