# Architecture Audit

Produced per `DesignSpec.md` §31 (Phase 0) / §50 (First Coding-Agent Task), ahead of the
household-platform rewrite. This is a read-only inspection — no application behaviour was
changed to produce it.

## 1. Current architecture

Next.js 14 App Router, TypeScript, Tailwind, Prisma + Neon Postgres, deployed on Vercel
(`vercel.json`: `npx prisma generate && next build`). No tRPC, no TanStack Query, no
shadcn/ui, no Server Actions — all client/server interaction is `fetch` from client
components to Next.js Route Handlers, with local `useState` for client state.

```
app/
  layout.tsx                      root layout, local Geist fonts
  page.tsx                        home: family name, feature tiles, member manager, invite code
  login/page.tsx                  login form
  todo/page.tsx                   per-member todo board
  api/
    config/route.ts               GET app_label (unauthenticated, legacy)
    auth/[...nextauth]/route.ts   NextAuth v5 handlers
    auth/signup/route.ts          registration (create-family or join-family)
    family-group/route.ts         PATCH family name
    family-users/route.ts         GET/POST family members
    family-users/[id]/route.ts    PATCH/DELETE a family member
    todos/route.ts                GET/POST todos
    todos/[id]/route.ts           PATCH/DELETE a todo
components/                       LoginForm, LogoutButton, FamilyCalendarTitle,
                                   InviteCodeCard, FamilyMemberManager, TodoBoard, TodoColumn
lib/
  prisma.ts                       singleton PrismaClient (cached on globalThis outside prod)
  auth.ts / auth.config.ts        NextAuth v5 (Credentials provider, JWT session)
  inviteCode.ts                   random invite code generation (family-group scope)
  familyUserColors.ts             fixed 5-colour palette + validation
middleware.ts                     NextAuth middleware, gates all non-API/static routes
next-auth.d.ts                    Session/User/JWT augmented with familyGroupId
prisma/
  schema.prisma
  migrations/                     5 migrations, oldest 2026-06-17, newest 2026-08-28
  seed.ts                         upserts app_label only
```

`app/api/config` and the `AppConfig` model are a leftover from the original kiosk-label
scaffold; nothing else reads `AppConfig`.

**Note on `CLAUDE.md`:** it currently describes the repo as having *only* `AppConfig`, one
API route, and no auth/family/todo code. That description is stale — the migrations show
auth, family, and todo functionality landed on 2026-08-28, after `CLAUDE.md` was last
updated. `CLAUDE.md` should be refreshed once this phase's plan is agreed, so future
sessions don't start from the stale picture.

## 2. Current database schema

```
AppConfig     id, key (unique), value                          — legacy, unrelated to rest
FamilyGroup   id, name, inviteCode (unique), createdAt
                -> users: User[], familyUsers: FamilyUser[]
User          id, email (unique), passwordHash, familyGroupId, createdAt
                -> familyGroup: FamilyGroup (cascade delete)
FamilyUser    id, name, color, createdAt, familyGroupId
                @@unique([familyGroupId, name])
                -> familyGroup: FamilyGroup (cascade delete)
                -> todos: Todo[]
Todo          id, text, completed, createdAt, userId
                -> familyUser: FamilyUser (cascade delete)
```

Observations relative to `DesignSpec.md` §9/§53's target model (`Family` /
`FamilyMembership` / `FamilyMember`):

- `FamilyGroup` ≈ target `Family`. `FamilyUser` ≈ target `FamilyMember`, but today it has no
  `role` (ADULT/CHILD), no `linkedUserId`, no `avatar`, no `active` flag — every `FamilyUser`
  is really "a person with a todo list," with no distinction between an adult with login
  access and a child.
- There is no `FamilyMembership` join model. `User.familyGroupId` is a direct 1:1 link — a
  `User` belongs to exactly one `FamilyGroup` with no explicit membership row, and there is
  no link from `User` to a `FamilyUser` (an adult's login identity and their "member" card in
  the UI are two disconnected rows today — e.g. `FamilyMemberManager` lists all `FamilyUser`
  rows including whichever one theoretically represents the logged-in adult, with no
  relationship between them).
- Invite codes (`FamilyGroup.inviteCode`) are permanent, single per family, stored in plain
  text, non-expiring, reusable indefinitely — the spec (§7) wants short-lived, single-use,
  hashed, rate-limited codes.
- `Todo.userId` actually references `FamilyUser.id`, not `User.id` — the column name is
  misleading relative to the two-model split the design spec formalises.
- No `CalendarEvent`, `Chore`, `Routine`, `ShoppingList`, or related models exist at all.

## 3. Current auth

NextAuth.js v5 (beta), Credentials provider, JWT session strategy, 1-year sliding maxAge
("kiosk tablet stays signed in indefinitely" per `lib/auth.config.ts:9`). Password hashing
via bcryptjs. Session/JWT are augmented with `familyGroupId` (`next-auth.d.ts`), which every
authenticated API route reads via `session.user.familyGroupId` to scope queries — this is
the app's only authorization mechanism, applied ad hoc per route rather than through a
shared `can(user, action, resource)` abstraction (design spec §6.2, §8 wants this
centralised).

`middleware.ts` gates every route except `/api/*` and static assets — note this means **API
routes are not protected by middleware at all**; each route handler independently calls
`auth()` and checks for a session (they all do this correctly today, but nothing enforces
that a new route does).

Registration (`api/auth/signup`) supports two modes, `create` (new `FamilyGroup` + invite
code) and `join` (existing invite code) — this already covers the shape of design spec §7's
household invitation, just without expiry/hashing/single-use/rate-limiting.

## 4. Current family model

`FamilyGroup` + `FamilyUser`, see §2 above. No role distinction between adults and children;
anyone can be added as a `FamilyUser` from the home page with just a name and colour, and
they immediately get a todo column. There is no concept of "this FamilyUser is also the
logged-in User" — an adult who signs up does not automatically get a corresponding
`FamilyUser` row, so a new family starts with zero `FamilyUser`s until someone manually adds
one from the UI, including themselves.

## 5. Current TODO model

One flat `Todo` per `FamilyUser`, `text` + `completed` only — no priority, due date,
category, or soft-delete-via-flag pattern (design spec §12 wants completed todos retained
rather than hard-deleted; the current `DELETE /api/todos/[id]` hard-deletes). Client state
(`TodoBoard`) does manual optimistic update + manual rollback on failure, by hand, per
component — this is exactly the pattern TanStack Query is meant to replace (design spec §21,
§46).

## 6. Current API

REST route handlers under `app/api/`, one file per resource, following roughly:
auth → parse body → validate inline (hand-rolled, no schema library) → scope to
`session.user.familyGroupId` → Prisma call → JSON response. No shared validation (no Zod),
no shared error-response shape (each route hand-writes `{ error: string }` with varying
status codes), no service/domain layer — Prisma calls sit directly in route handlers (design
spec §23 wants route → domain service → Prisma). IDOR protection is present and consistent:
every mutating/list route filters by `familyGroupId` derived from the session, never from
client input — this matches design spec §25/§27's core security rule already.

## 7. Current frontend structure

Server components fetch via Prisma directly in `page.tsx`/`todo/page.tsx` (with a
try/catch-to-fallback-string pattern, not re-thrown) and pass data as props into client
components that then re-fetch/mutate via `fetch()` to the API routes. No shared data-fetching
layer, no cache, no realtime — every mutation manually patches local `useState`.

## 8. Technical debt

- No service/domain layer; authorization and business rules are inline in route handlers.
- No schema validation library; validation is hand-rolled per route, inconsistently (e.g.
  `todos/route.ts` requires `userId` to be a number, `family-users/route.ts` doesn't validate
  types as strictly).
- No shared API error/response shape.
- No tests of any kind (no test runner configured, no `*.test.*` files in the repo).
- Optimistic-update-with-manual-rollback logic is duplicated per component
  (`TodoBoard`, `FamilyMemberManager`) — will only grow more repetitive as chores/routines/
  shopping are added without TanStack Query.
- `AppConfig`/`api/config` is dead weight relative to everything else — nothing in the app
  reads it besides the (currently unused) original kiosk label flow described in the stale
  `CLAUDE.md`.
- `next-auth` is a beta version (`5.0.0-beta.32`) slated for full replacement per design spec
  §6.

## 9. Security concerns

- Invite codes are permanent, unhashed, unlimited-use, and never expire — a leaked code
  grants indefinite join access to the family. No rate limiting on signup or invite-code
  attempts (brute-forceable given codes are only 10 hex chars, though `generateUniqueInviteCode`
  itself is fine for uniqueness).
- No family membership/authorization abstraction — every route re-derives
  `session.user.familyGroupId` and re-applies the same filter by hand; correct today, but
  nothing prevents a future route from forgetting it (no centralised `can()` guard as design
  spec §6.2/§8 requires).
- `middleware.ts` does not cover `/api/*`, so route-level auth checks are the only
  protection for API endpoints — currently present and correct on every route, but
  structurally easy to regress.
- Session lifetime is a 1-year JWT with no server-side revocation list — acceptable for a
  kiosk-first app per the code comment, but worth being explicit that a compromised token is
  valid for a very long time.

## 10. Proposed migration path

Follow `DesignSpec.md`'s own phase order (§32–§42), since the existing code already lines up
reasonably closely with the target shape (it is not a from-scratch build):

1. **Phase 1 — Foundation**: introduce Zod, TanStack Query, a shared API error/response
   helper, and a `lib/authz.ts`-style `can()` abstraction, without changing behaviour.
2. **Phase 2 — Better Auth**: add Better Auth alongside NextAuth, migrate `User` →
   Better Auth's user/session tables, introduce `FamilyMembership`, keep NextAuth routes
   until Better Auth is verified end-to-end, then remove NextAuth.
3. **Phase 3 — Family management**: extend `FamilyUser` → `FamilyMember` with `role`,
   `avatar`, `active`, `linkedUserId`; link the signing-up adult's `User` to a `FamilyMember`
   row automatically.
4. **Phase 4 — TODO migration**: add `priority`, switch hard-delete to `completed=true`
   retention (or confirm with product owner that hard-delete is intentionally kept), move
   optimistic logic onto TanStack Query.
5. **Phases 5–9**: add `CalendarEvent`/`EventParticipant`, `Chore`/`ChoreSchedule`/
   `ChoreOccurrence`, `Routine` family of models, `ShoppingList`/`ShoppingItem`, then the
   combined dashboard — each as its own migration + service + API + UI slice, per design
   spec §36–§40.
6. **Phase 10 — Wall display mode.**
7. Realtime (design spec §20) can be layered in per-domain once each domain's REST API and
   TanStack Query wiring exists — it doesn't block earlier phases.

## 11. Files likely to change

- `prisma/schema.prisma` + new migrations — every phase from 2 onward.
- `lib/auth.ts`, `lib/auth.config.ts`, `middleware.ts`, `next-auth.d.ts` — replaced by
  Better Auth equivalents in Phase 2.
- `app/api/auth/*`, `app/api/family-group/*`, `app/api/family-users/*` — reshaped around
  `Family`/`FamilyMember`/`FamilyMembership`.
- `app/api/todos/*`, `components/TodoBoard.tsx`, `components/TodoColumn.tsx` — TanStack
  Query migration + priority field.
- New: `app/api/calendar/*`, `app/api/chores/*`, `app/api/routines/*`, `app/api/shopping/*`
  and their `lib/services/*` domain-layer counterparts.
- `app/page.tsx` — becomes the family dashboard; the "Coming soon" tiles get wired up
  in the phase that implements each feature.
- `CLAUDE.md` — needs a refresh once Phase 1 lands, since it currently under-describes the
  app relative to what's actually in this repo.

## 12. Risks

- **Auth cutover risk**: dual-running NextAuth and Better Auth session strategies
  simultaneously (design spec §6.1) needs a clear boundary so a user is never in a state
  where one system thinks they're logged in and the other doesn't.
- **Data migration risk**: `User`/`FamilyGroup`/`FamilyUser`/`Todo` rows must survive the
  `FamilyMembership` + `FamilyMember` role split without orphaning existing todos — the
  `Todo.userId → FamilyUser.id` relationship must be preserved exactly through any rename.
- **No test safety net**: with zero existing tests, every migration phase is refactoring
  without a regression harness until Phase 1's "testing foundation" lands — extra manual
  verification is needed for Phases 1–2 specifically.
- **Invite code hashing migration**: switching from plaintext to hashed invite codes means
  existing unused invite codes either need re-issuing or a one-time migration that hashes
  them in place; decide which before implementing §7.
- **Scope size**: the full design spec is 11 phases covering auth replacement, four new
  domains, realtime sync, and a wall-display mode. Given Rule 6 ("small changes" — typecheck/
  lint/test/build after each), this should proceed as a sequence of separately-reviewable
  changes rather than one large change.

## 13. Contradictions between current implementation and `DesignSpec.md`

- §3 of `DesignSpec.md` describes the existing API surface accurately (auth, signup,
  family-users, family-group, todos all exist as named) — no contradiction there, this part
  of the spec is up to date with the repo.
- `CLAUDE.md`, by contrast, describes a much earlier state (`AppConfig`-only schema, single
  `api/config` route, no auth/family/todo code) that no longer matches the repository. This
  is a contradiction between two docs, not between the spec and the code — `CLAUDE.md` is
  the stale one.
- Design spec §5.3 lists `dateOfBirth` and `avatar` as `FamilyMember` fields; neither exists
  on `FamilyUser` today.
- Design spec §12 wants completed TODOs retained (`completed=true`) rather than deleted; the
  current `DELETE /api/todos/[id]` performs a real delete, and there is no separate "hide
  completed" UI affordance — todos are just deleted outright today.
