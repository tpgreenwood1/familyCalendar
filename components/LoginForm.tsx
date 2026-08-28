"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "login" | "signup";
type SignupMode = "create" | "join";

export default function LoginForm() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [signupMode, setSignupMode] = useState<SignupMode>("create");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [familyGroupName, setFamilyGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError("Enter a valid email");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Incorrect email or password");
        return;
      }
      router.push("/");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: signupMode,
          email: normalizedEmail,
          password,
          familyGroupName,
          inviteCode,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not create account. Please try again.");
        return;
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Account created — please log in.");
        setMode("login");
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
        Family Calendar
      </p>

      <div className="mt-10 flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`flex-1 rounded-lg px-4 py-3 text-lg ${
            mode === "login" ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`flex-1 rounded-lg px-4 py-3 text-lg ${
            mode === "signup" ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400"
          }`}
        >
          Sign Up
        </button>
      </div>

      {mode === "signup" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setSignupMode("create")}
            className={`flex-1 rounded-lg px-4 py-2 text-base ${
              signupMode === "create" ? "bg-gray-800 text-white" : "bg-gray-950 text-gray-500"
            }`}
          >
            New Family
          </button>
          <button
            type="button"
            onClick={() => setSignupMode("join")}
            className={`flex-1 rounded-lg px-4 py-2 text-base ${
              signupMode === "join" ? "bg-gray-800 text-white" : "bg-gray-950 text-gray-500"
            }`}
          >
            Join With Code
          </button>
        </div>
      )}

      <form
        onSubmit={mode === "login" ? handleLogin : handleSignup}
        className="mt-6 flex flex-col gap-4"
      >
        {mode === "signup" && signupMode === "create" && (
          <input
            type="text"
            value={familyGroupName}
            onChange={(e) => setFamilyGroupName(e.target.value)}
            placeholder="Family surname"
            className="rounded-lg bg-gray-800 px-4 py-3 text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        )}
        {mode === "signup" && signupMode === "join" && (
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Invite code"
            className="rounded-lg bg-gray-800 px-4 py-3 text-xl uppercase tracking-widest text-white placeholder-gray-500 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="rounded-lg bg-gray-800 px-4 py-3 text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full rounded-lg bg-gray-800 px-4 py-3 pr-16 text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-gray-400 hover:text-white"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {mode === "signup" && (
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="w-full rounded-lg bg-gray-800 px-4 py-3 pr-16 text-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-gray-400 hover:text-white"
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-lg bg-gray-700 px-6 py-3 text-xl text-white hover:bg-gray-600 disabled:opacity-50"
        >
          {mode === "login" ? "Log In" : "Sign Up"}
        </button>

        {error && <p className="text-center text-sm text-gray-500">{error}</p>}
      </form>
    </div>
  );
}
