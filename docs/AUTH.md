# Authentication & Authorization

Phase 2 of `DesignSpec.md` (§33). Better Auth replaces NextAuth v5 as the account/session
system; `Family`/`FamilyMember` (here: `FamilyGroup`/`FamilyMember`) remain the authoritative
domain concepts, per §6.2. (At the time this doc was written, in Phase 2, `FamilyMember` was
still named `FamilyUser` and had no `role`/`linkedUserId` split — see `docs/ARCHITECTURE_AUDIT.md`
for that snapshot and Phase 3's changes.)

## Why Better Auth's organization plugin isn't used

DesignSpec.md §6.2 permits using Better Auth's organization/membership plugin for adult
membership, but warns against depending on it for the domain model. This repo already has
`FamilyGroup` (predates the rewrite) as the authoritative "family" concept. Adopting the
organization plugin as well would mean reconciling two competing "family" concepts
(Better Auth's `Organization` vs. our `FamilyGroup`) for no real benefit at this scale — so
Phase 2 uses only Better Auth's core primitives (`User`/`Session`/`Account`/`Verification`)
plus two purpose-built models: `FamilyMembership` and `Invitation`.

## Data model

- `User` / `Session` / `Account` / `Verification` / `RateLimit` — Better Auth's own tables,
  generated via `npx auth generate --config lib/auth.ts` against the Postgres adapter. Don't
  hand-edit these to "fix" a field — regenerate instead, so the shape stays in sync with
  whatever Better Auth version is installed.
- `FamilyMembership` — links a Better Auth `User` to a `FamilyGroup`. Unique on `userId`
  (not a composite key) because §5.1/§30 keep "one adult, one family" for now.
- `Invitation` — replaces the old `FamilyGroup.inviteCode` (plaintext, permanent,
  unlimited-use). Stores only `codeHash` (SHA-256); the plaintext code is returned exactly
  once, in the API response when it's created (`POST /api/invitations` or as part of
  `POST /api/family/setup` for a brand-new family). Codes expire after 7 days and are
  single-use, enforced atomically in `lib/invitations.ts#consumeInvitation` via a
  conditional `updateMany` (`WHERE usedAt IS NULL`) rather than a read-then-write.
- `InviteAttempt` — minimal DB-backed rate limiting (§27) for the join-by-code endpoint: at
  most 5 attempts per email per 15 minutes. Better Auth's own `rateLimit` table (configured
  with `storage: "database"`, since Vercel is serverless — in-memory rate limiting wouldn't
  survive across instances) separately covers Better Auth's built-in sign-in/sign-up
  endpoints.

## Password compatibility

Better Auth's default password hashing is scrypt, incompatible with the bcrypt hashes
already stored for pre-existing users. `lib/auth.ts` wires Better Auth's
`emailAndPassword.password.hash`/`verify` to `lib/password.ts`, which wraps `bcryptjs` (the
dependency already in use) — so migrated users keep their original password with no forced
reset, and new signups also hash with bcrypt for consistency.

## Signup flow

`DesignSpec.md` §6.1 treats "create an account" and "attach that account to a family" as
separate steps — a Better Auth session can validly exist with no `FamilyMembership` yet.
This repo keeps that as a single user-facing form in the common case, but as two real
requests:

1. `components/LoginForm.tsx`'s signup step calls `authClient.signUp.email(...)` (Better
   Auth's own endpoint) — creates the `User` + session cookie.
2. It then calls `POST /api/family/setup` with `{ mode: "create", familyGroupName }` or
   `{ mode: "join", inviteCode }` to create/join the family and create the
   `FamilyMembership`.

If step 2 fails (bad invite code, dropped connection, etc.) after step 1 already succeeded,
the user has a valid account but no family. `app/page.tsx` and `middleware.ts` handle this
by redirecting such sessions to `/family-setup` (`components/FamilySetupForm.tsx`) — the
same create/join UI, reachable any time a signed-in user has no `FamilyMembership` — instead
of forcing them to sign up again.

## Sign-up gate (dev phase)

Not a `DesignSpec.md` feature — a temporary safeguard while the app sits at a live but
unlisted Vercel URL during testing. `lib/auth.ts` wires a Better Auth
`databaseHooks.user.create.before` hook that fires only when a new `User` row is about to be
created (i.e. only on sign-up — sign-in never touches `user.create`, so already-approved
accounts keep working unaffected). The hook checks the submitted email against
`lib/signupAllowlist.ts#isEmailAllowedToSignUp`, which reads the comma-separated
`ALLOWED_SIGNUP_EMAILS` env var (case-insensitive, whitespace-trimmed). An email not on the
list gets a `console.warn` (visible in Vercel function logs — this is the only "notification"
that exists right now, there's no email/SMS to the admin) and the sign-up request is aborted
with a Better Auth `APIError` whose message ("...in its development phase, a request for
access has been sent to the administrator...") surfaces verbatim through
`components/LoginForm.tsx`'s existing `signUpError.message` error handling, with no UI code
changes needed.

`ALLOWED_SIGNUP_EMAILS` unset or empty **denies everyone** — the safe default, so a fresh
environment (or a forgotten Vercel env var) can't accidentally leave sign-up open. Set it
locally in `.env` and in the Vercel project's env vars for whichever emails should be able to
sign up.

This is a blunt, temporary measure — reconsider or remove it before any real public launch.

## Session checks

- `lib/authz.ts#getCurrentUser()` — server components/pages; returns `null` if signed out.
- `lib/authz.ts#getFamilyMembership(userId)` — separately distinguishes "signed in, no
  family yet" (→ `/family-setup`) from "signed out" (→ `/login`).
- `lib/authz.ts#requireSession()` — API routes; throws a 401 `ApiError` if signed out, 409 if
  signed in but not attached to a family, otherwise returns `{ user, familyGroupId }`.
- `middleware.ts` does an optimistic `getSessionCookie()` presence check only — Next.js 14
  middleware runs on the Edge runtime, which can't do a real DB-backed session lookup. Real
  verification happens per-page/per-route as above, same as the previous NextAuth setup.

## Migrating existing accounts

`scripts/migrate-legacy-users.ts` is a one-off, idempotent script (not part of the Next.js
app or build) that copies every `LegacyUser` row into Better Auth's `User`/`Account` tables
(reusing the bcrypt hash) plus a `FamilyMembership`, and mints one fresh `Invitation` per
family that doesn't already have an active one. Run it once locally after deploying the
Phase 2 schema changes:

```bash
npx ts-node scripts/migrate-legacy-users.ts
```

The old plaintext invite code isn't migrated (an invite code is a credential, not user data
— re-issuing is fine); the script prints each family's newly minted code once.

`LegacyUser` itself is left in place, unused, as a rollback reference — drop it in a later
cleanup once the migration has been verified in production, not as part of this phase.

## NextAuth removal

Per §6.1 step 12 ("remove NextAuth only after Better Auth has been proven"): NextAuth was
removed after manual end-to-end verification passed, including the one check that couldn't
be automated — the pre-existing account logging in with its original (pre-migration)
password. `app/api/auth/[...nextauth]/route.ts`, `app/api/auth/signup/route.ts`,
`lib/auth.config.ts`, `next-auth.d.ts`, the `next-auth` dependency, and the `AUTH_SECRET` env
var are all gone; Better Auth is the only auth system in the app now.
