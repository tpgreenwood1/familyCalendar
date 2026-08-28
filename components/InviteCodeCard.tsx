"use client";

import { useState } from "react";

export default function InviteCodeCard({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can fail (permissions, non-secure context) — no-op, code is still visible
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-gray-900 px-6 py-6">
      <p className="text-sm text-gray-400">
        Invite code — share with family to let them join
      </p>
      <p className="text-3xl tracking-widest text-white">{inviteCode}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
