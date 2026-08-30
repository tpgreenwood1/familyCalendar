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
      className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
    >
      Log Out
    </button>
  );
}
