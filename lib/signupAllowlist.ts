/**
 * Dev-phase sign-up gate: only email addresses listed in `ALLOWED_SIGNUP_EMAILS`
 * (comma-separated, case-insensitive) may create a new account. Unset/empty denies
 * everyone -- a safe default so a missing env var never accidentally opens sign-up
 * to the public. See docs/AUTH.md "Sign-up gate (dev phase)".
 */
export function isEmailAllowedToSignUp(email: string): boolean {
  const allowlist = (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.trim().toLowerCase());
}
