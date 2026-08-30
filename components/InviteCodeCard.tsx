"use client";

import { useState } from "react";

export default function InviteCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/invitations", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not generate an invite code. Please try again.");
        return;
      }
      setCode(body.code);
      setCopied(false);
    } catch {
      setError("Could not generate an invite code. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
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

      {code ? (
        <>
          <p className="text-3xl tracking-widest text-white">{code}</p>
          <p className="text-xs text-gray-500">
            Save this now — it won&apos;t be shown again. Valid for 7 days, one use only.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-lg px-6 py-3 text-lg text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
            >
              Generate another
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-gray-700 px-6 py-3 text-lg text-white hover:bg-gray-600 disabled:opacity-50"
        >
          {isGenerating ? "Generating…" : "Generate invite code"}
        </button>
      )}

      {error && <p className="text-sm text-gray-500">{error}</p>}
    </div>
  );
}
