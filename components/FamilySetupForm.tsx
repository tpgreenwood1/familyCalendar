"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SignupMode = "create" | "join";

export default function FamilySetupForm() {
  const router = useRouter();

  const [signupMode, setSignupMode] = useState<SignupMode>("create");
  const [familyGroupName, setFamilyGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (signupMode === "create" && !familyGroupName.trim()) {
      setError("Family name is required");
      return;
    }
    if (signupMode === "join" && !inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/family/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          signupMode === "create"
            ? { mode: "create", familyGroupName }
            : { mode: "join", inviteCode }
        ),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not continue. Please try again.");
        return;
      }
      router.push("/");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <p className="text-center text-4xl font-light tracking-widest text-white">
        Join or Create a Family
      </p>
      <p className="mt-4 text-center text-sm text-gray-400">
        Your account is ready — now create a new family or join one with an invite code.
      </p>

      <div className="mt-8 flex gap-2">
        <button
          type="button"
          onClick={() => setSignupMode("create")}
          className={`flex-1 rounded-lg px-4 py-3 text-lg ${
            signupMode === "create" ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400"
          }`}
        >
          New Family
        </button>
        <button
          type="button"
          onClick={() => setSignupMode("join")}
          className={`flex-1 rounded-lg px-4 py-3 text-lg ${
            signupMode === "join" ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400"
          }`}
        >
          Join With Code
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {signupMode === "create" ? (
          <input
            type="text"
            value={familyGroupName}
            onChange={(e) => setFamilyGroupName(e.target.value)}
            placeholder="Family surname"
            autoFocus
            className="rounded-lg bg-gray-800 px-4 py-3 text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        ) : (
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Invite code"
            autoFocus
            className="rounded-lg bg-gray-800 px-4 py-3 text-xl uppercase tracking-widest text-white placeholder-gray-500 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-lg bg-gray-700 px-6 py-3 text-xl text-white hover:bg-gray-600 disabled:opacity-50"
        >
          Continue
        </button>

        {error && <p className="text-center text-sm text-gray-500">{error}</p>}
      </form>
    </div>
  );
}
