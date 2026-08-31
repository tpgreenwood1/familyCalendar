# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A household platform (Skylight-Calendar-like), being rewritten from an earlier todo-list
prototype per `DesignSpec.md`: Family/FamilyMember/FamilyMembership domain, Better Auth,
a shared calendar, chores, routines, a shopping list, realtime sync, and a wall-mounted
tablet display mode. Next.js 14 (App Router, TypeScript, Tailwind), Prisma + Neon Postgres,
deployed on Vercel.

**The rewrite is in progress, phase by phase** — see `DesignSpec.md` §31 onward for the
phase list and `docs/ARCHITECTURE_AUDIT.md` for the Phase 0 gap analysis. Treat
`DesignSpec.md` as the target, not a description of everything already built.
`DesignSpec-old.md` is the previous (kiosk-photo-calendar) spec, kept only as reference —
none of its Google Photos/R2/idle-gallery design applies anymore.

**Done so far:**
- Phase 0 (audit) — `docs/ARCHITECTURE_AUDIT.md`.
- Phase 1 (foundation) — Zod (`lib/schemas.ts`), TanStack Query (`app/providers.tsx`), a
  shared API error shape (`lib/api-errors.ts`), a centralized `can()`/`requireCan()`
  authorization abstraction (`lib/authz.ts`).
- Phase 2 (Better Auth) — see `docs/AUTH.md`. NextAuth is fully replaced; email/password
  auth, sessions, family creation, and invite-code-based joining all run on Better Auth.
- Phase 3 (Family Management) — `FamilyUser` was renamed/extended into the real
  `FamilyMember` model from `DesignSpec.md` §5.3 (`role` ADULT/CHILD, `avatar`,
  `dateOfBirth`, `active`, `linkedUserId`). Signing up or joining a family now also creates
  a linked `ADULT` `FamilyMember` for that `User` (`app/api/family/setup/route.ts`), closing
  the old gap where an adult had no card in the roster. `FamilyMemberManager` shows Adults
  (read-only, except a member can edit their own card) and Children (full add/edit/
  deactivate/remove, per `app/api/family-members/`). Removing/editing *other* adults
  ("manage adult membership" in the spec) is intentionally not built yet.
- Phase 4 (TODO Migration) — `Todo` moved onto the `FamilyMember` architecture, gained a
  `priority` flag, and `TodoBoard`/`TodoColumn` do optimistic completion. Realtime (§47) is
  implemented as polling: `lib/realtime.ts`'s `publishDomainEvent`/`subscribeToFamilyEvents`
  are the stable seam a later SSE/WebSocket upgrade would slot into without touching call
  sites — this is the actual strategy per the spec's escalation path, not a placeholder.
- Phase 5 (Calendar) — `CalendarEvent`/`EventParticipant` (`DesignSpec.md` §10), `lib/
  calendar.ts` (domain/service layer per §23), `lib/recurrence.ts` (simple Daily/Weekly/
  Monthly presets stored as an RFC5545 `rrule` fragment, expanded with Luxon at read time —
  per-occurrence edit/exclusion is still the future-phase item §10.5 calls out, so
  editing/deleting a recurring event always applies to the whole series). Day/multi-day/week
  views are one parameterised `CalendarGrid` component. `FamilyGroup.timezone` (default
  `"Europe/London"`) drives recurrence expansion server-side; the client itself renders in
  browser-local time on the assumption household devices share the family's timezone.
- Phase 6 (Chores) — `Chore`/`ChoreSchedule`/`ChoreOccurrence` (`DesignSpec.md` §13), `lib/
  chores.ts` (domain/service layer, mirroring `lib/calendar.ts`'s shape). V1 is exactly one
  `ChoreSchedule` per `Chore` (a single assignee plus a fixed `daysOfWeek` set, JS
  `Date#getDay()` convention 0=Sunday..6=Saturday) — the schema keeps the schedule in its own
  table so a future phase can add rotation/multiple assignees without a migration, but the
  API/UI enforce "one schedule" for now. `generateChoreOccurrences` is idempotent (unique
  constraint on `choreId`+`familyMemberId`+`date` plus `createMany({ skipDuplicates: true })`)
  and is called on-demand from `GET /api/chores/occurrences` rather than a cron — no
  `vercel.json` cron entry exists yet. Completing/skipping an occurrence
  (`setChoreOccurrenceStatus`) never touches the `ChoreSchedule` that generated it, per
  §13.5. Points/rewards/rotation/approval are explicitly out of scope per §13.6.
  `createChore`/`updateChore` normalize `title` to capitalized casing regardless of input
  (`lib/textFormat.ts#capitalize`, shared with `lib/shopping.ts`). Adding a chore
  (`ChoreModal.tsx`, create mode only) offers a fixed starter list
  (`lib/predefinedChores.ts`) via a dropdown plus a "Custom…" option that reveals a
  free-text field. The `/chores` board's per-member columns (`ChoreBoard.tsx`/
  `ChoreColumn.tsx`) are a responsive wrapping grid rather than a fixed-width horizontal
  scroller. Editing (title, assignee, schedule, active flag, delete) moved off the main
  board entirely onto a separate `/chores/edit` page (`ChoreEditList.tsx`), filterable by
  family member, reusing the same `GET/POST/PATCH/DELETE /api/chores` endpoints and the
  same `["chores"]` TanStack Query cache so edits there are reflected back on `/chores`
  without a refresh — per §13.7. Clicking a member's name on `/chores`
  (`ChoreColumn.tsx`) opens `/chores/[memberId]` (`ChoreWeekOverview.tsx`), a read-only
  overview of that member's chores for the current week only (no prev/next navigation) —
  per §13.8, deliberately narrower than the "completion history UI" §13.6 excludes.
  `lib/chores.ts#listChoreOccurrencesForWeek` generates all 7 days via the same idempotent
  `generateChoreOccurrences` used for a single day, returning the whole family's occurrences
  for the week (`GET /api/chores/occurrences/week`); the client filters to one member and
  buckets by day using an exact millisecond offset from the returned `weekStart`, avoiding
  any client-timezone guessing.
- Phase 7 (Routines) — `Routine`/`RoutineSchedule`/`RoutineItem`/`RoutineOccurrence`/
  `RoutineItemCompletion` (`DesignSpec.md` §15), `lib/routines.ts` (domain/service layer,
  same shape as `lib/chores.ts` — `generateRoutineOccurrences` is the same idempotent
  unique-constraint-plus-`skipDuplicates` pattern as `generateChoreOccurrences`, called
  on-demand from `GET /api/routines/occurrences`). V1 is exactly one `RoutineSchedule` per
  `Routine` (a single assignee on the `Routine` itself, `daysOfWeek` on the schedule, same
  `Date#getDay()` convention as `ChoreSchedule`). A `RoutineItemCompletion` row's mere
  existence means "checked" — ticking upserts it, unticking deletes it — rather than a
  boolean flag, so `RoutineOccurrence` GETs never need a separate reset step.
  `FamilyGroup.holidayMode` (§15.4) is a simple household-wide toggle (`PATCH
  /api/family-group`); V1 only implements the "disable" half of what the spec asks the data
  model to allow — `RoutineSchedule.activeDuringHoliday` defaults to `false`, so
  `generateRoutineOccurrences` skips a routine's schedule whenever holiday mode is on unless
  that routine opted in. Editing a `Routine`'s item list is a full replace, not a per-item
  diff — see the comment in `updateRoutine`.
- Phase 8 (Shopping) — `ShoppingList`/`ShoppingItem` (`DesignSpec.md` §16), `lib/
  shopping.ts` (domain/service layer). V1 is deliberately minimal: one shared list per
  family (`ShoppingList.familyGroupId` is `@unique`), add/check/uncheck/delete, no
  quantity/store (all explicitly future per §16). The list is created lazily —
  `getOrCreateShoppingList` finds-or-creates it on first read/write rather than at family
  setup — so no signup-flow change was needed. `ShoppingList` stays a separate table from
  `FamilyGroup` (rather than items hanging directly off it) so the spec's future "multiple
  lists" option doesn't need a schema change later. Every item carries a fixed
  `ShoppingItemCategory` enum (`GROCERIES` | `OTHER`, defaults to `GROCERIES`) that
  `ShoppingList.tsx` renders as two side-by-side columns ("Groceries" / "Other Items") —
  this is a fixed two-bucket split, not the spec's future user-defined categories.
  `addShoppingItem` normalizes `name` to capitalized casing (first letter uppercase, rest
  lowercase) regardless of how it was typed, so display stays consistent across the
  shopping page, dashboard, and wall display without each consumer re-normalizing.
- Phase 9 (Family Dashboard) — `DesignSpec.md` §17/§40, new `/dashboard` route
  (`app/dashboard/page.tsx`, `components/FamilyDashboard.tsx`,
  `components/MemberDashboardCard.tsx`), linked from the home page's Features grid. No new
  domain logic or API routes — it's a read/combine layer over the existing five domains'
  service functions and endpoints, reusing the exact same TanStack Query keys
  (`["todos"]`, `["chore-occurrences"]`, `["routine-occurrences"]`, `["calendar-events", ...]`,
  `["shopping-items"]`) as their dedicated pages so cache stays coherent when navigating
  between them. Per-member cards combine that member's today's chore occurrences, today's
  routine occurrences/items, and incomplete todos (todos have no due date in V1, so "today's
  todos" is just "incomplete todos") with inline complete/skip/tick controls; a separate
  card lists today's calendar events; the shopping list is the existing `ShoppingList`
  component embedded as-is rather than re-implemented. "Today" for both the dashboard's
  server-rendered initial data and its client-side refetch is computed from local
  (server/browser) time via `getViewRange("day", ...)`, matching the same approximation
  `app/calendar/page.tsx` and `CalendarBoard` already use rather than the family's IANA
  timezone.
- Phase 10 (Wall Display) — `DesignSpec.md` §18/§41, new `/wall` route
  (`app/wall/page.tsx`, `components/WallDisplay.tsx`). Fetches the same data as `/dashboard`
  via a shared `lib/dashboardData.ts#getDashboardData`, and shares its TanStack Query
  hooks/mutations with `FamilyDashboard` via `lib/useDashboardQueries.ts` (extracted in this
  phase) so both views' caches stay coherent regardless of which is mounted. The wall is its
  own full-screen layout, not a CSS-scaled dashboard: a big clock/date, a compact member-tile
  overview (name + done-today count, no per-item detail), a horizontally-scrolling "Today's
  Calendar" strip, and a "Shopping List" tile. Tapping a member tile or the shopping tile
  drills into a large-format focus view — `MemberDashboardCard` grew a `large` prop (bigger
  type, `h-10 w-10` checkboxes) rather than a separate component, since it's the same data
  and mutations, just sized for across-the-room use; the shopping focus view reuses
  `ShoppingList` as-is. `lib/useIdleReturn.ts` implements "automatic return to dashboard
  after inactivity" (§18): 30s with no touch/pointer/key activity while a focus view is open
  snaps back to the overview; the overview itself has nothing to idle out of. A
  `portrait:flex` overlay (Tailwind's built-in orientation variant) nudges rotation on a
  portrait tablet — CSS-only, no JS orientation detection. No new domain logic, API routes,
  or auth changes — Better Auth's already-indefinite kiosk session (`lib/auth.ts`) already
  satisfies §18's "don't require repeated login" requirement.
- Phase 11 (Future Placeholders) — `DesignSpec.md` §42, `components/FuturePlaceholderTiles.tsx`.
  Two disabled, non-interactive tiles ("⭐ Rewards", "🍽 Meal Planning") rendered at the bottom
  of both `FamilyDashboard` and `WallDisplay` (the latter via a `large` prop, matching the
  sizing pattern `MemberDashboardCard` already uses). Visual-only per spec — no schema, API
  routes, or domain logic, and intentionally not wired to anything.
- Phase 12 (Special Occasions) — `DesignSpec.md` §16A/§42A, `SpecialOccasion`
  (`prisma/schema.prisma`), `lib/specialOccasions.ts`. Deliberately just one table, not Chore/
  Routine's definition+schedule+occurrence trio — nothing here is ever completed/skipped, so
  there's no occurrence to persist; `computeOccasionFields` derives `nextOccurrenceDate`/
  `daysUntil`/`isToday`/`computedYears` on every read instead, taking `today` as a parameter
  (rather than resolving it itself) specifically so it's unit-testable without a family/DB
  dependency (`lib/specialOccasions.test.ts`), mirroring how `lib/recurrence.test.ts` feeds
  `expandOccurrences` fixed `Date`s. `originalDate` stores one `DateTime` (year included)
  rather than a separate "initiating year" field — the year of that date *is* the initiating
  year. `isSomber` is a plain boolean (not an enum like `RoutinePeriod`), since it's purely a
  display flag (icon/wording), never a behavioural branch — happy and somber occasions sort
  and render with equal prominence in the same list. No `FamilyMember` relation by design:
  `title` is free text, so a pet, grandparent, or deceased relative can have an occasion
  without a roster card — `FamilyMember.dateOfBirth` (§5.3) is never read by this feature,
  since no UI anywhere actually collects it yet. `createSpecialOccasion`/
  `updateSpecialOccasion` deliberately skip the `capitalize()` normalization `lib/chores.ts`/
  `lib/shopping.ts` apply to their titles, since occasion titles are free-text phrases ("Mum's
  Birthday") that normalization would mangle. `GET /api/special-occasions` returns the whole
  family's occasions pre-sorted soonest-first with the computed fields already attached —
  there's no separate "upcoming" endpoint; the dashboard card and wall tile just filter the
  same list to `daysUntil <= 7` client-side, the same way `FamilyDashboard` already filters
  chore/routine occurrences per member. `components/SpecialOccasionList.tsx` owns its own
  TanStack Query key/mutations (`SPECIAL_OCCASIONS_QUERY_KEY`/`fetchSpecialOccasions`) and is
  reused as-is for both the `/occasions` page and `WallDisplay`'s tap-to-open focused view, the
  same way `ShoppingList.tsx` is shared between `/shopping` and the wall's shopping focus view;
  `components/SpecialOccasionCard.tsx` is the dashboard-only 7-day digest, and `WallDisplay`
  gained an `occasionsOpen` state mirroring `shoppingOpen` (including in `useIdleReturn`'s
  active-condition).
- Phase 13 (Photo Screensaver) — `DesignSpec.md` §16B/§42B, `PhotoAlbum`/`Photo` models plus
  four flat screensaver fields on `FamilyGroup` (`screensaverEnabled`/`screensaverAlbumId`/
  `screensaverIntervalSeconds`/`screensaverIdleSeconds`), same shape as `holidayMode` rather
  than a separate settings table. Photos are stored in Vercel Blob (`@vercel/blob`), not
  synced from an external service — `lib/photos.ts` is the domain/service layer (album CRUD,
  photo add/delete calling Blob's `del()` alongside the DB row, and
  `getScreensaverSettings`). Uploads go client-to-Blob directly (`components/
  PhotoManager.tsx`'s `upload()` call against `POST /api/photos/upload`, which only hands out
  a family-scoped token via `onBeforeGenerateToken` — it never receives the file); there is
  deliberately no `onUploadCompleted` webhook, since that requires a publicly reachable URL
  that localhost can't satisfy, so the client instead POSTs the resolved blob's URL/pathname
  to `POST /api/photos/albums/[id]/photos` once `upload()` resolves, keeping dev/prod
  behaviour identical. `screensaverAlbumId` is `@unique` with `onDelete: SetNull`; deleting
  the album currently selected for the screensaver also flips `screensaverEnabled` back to
  `false` explicitly (`lib/photos.ts#deleteAlbum`), rather than leaving it enabled with no
  album. Two entry points share the same `PhotoScreensaver` component and the same
  `lib/usePhotoScreensaver.ts` query (`["photo-screensaver"]`, reading `GET
  /api/photos/screensaver`): a manual "Photos" tile on both `FamilyDashboard` and
  `WallDisplay`, and — Wall Display only — a second, independent `lib/useIdleReturn.ts` timer
  (the existing 30s focus→overview one is unaffected) that auto-launches it after the
  household's configured idle delay whenever the wall is sitting on the plain overview.
  `/photos` (`components/PhotoManager.tsx`) is the management page: album create/rename/
  delete, per-album photo upload/delete, and the screensaver settings form, all against the
  same `PATCH /api/family-group` endpoint `holidayMode` already used for its enable/album/
  interval/idle fields.
- Documentation (§48) — `docs/SPEC.md` (product baseline), `docs/ARCHITECTURE.md` (layers,
  directory map, request flow), `docs/DATABASE.md` (schema), `docs/API.md` (every route), and
  `docs/ROADMAP.md` (phase-by-phase status, superseding the ad hoc "Done so far"/"Not built
  yet" bullets below as the canonical status list) — added alongside the pre-existing
  `docs/AUTH.md` and `docs/ARCHITECTURE_AUDIT.md`. Also in the working tree but not yet a
  named phase: Vitest (`vitest.config.ts`, `npm test`) with unit coverage for
  `lib/recurrence.ts`, `lib/schemas.ts`, and `lib/authz.ts` — the first slice of the Testing
  Strategy (§43); integration/e2e tests are still outstanding, see `docs/ROADMAP.md`.
- Shared UI shell (not yet a named phase) — `components/Header.tsx` (async Server Component;
  independently resolves the signed-in user's family name the same way every page-level
  Server Component already does, and renders it as a link back to `/`), `components/
  HeaderNav.tsx` (client, `usePathname`-based active-link highlighting across Home/Dashboard/
  Calendar/Chores/Routines/Shopping/Occasions/To Do/Wall/Family/Settings), and
  `components/Footer.tsx`.
  These replace the identical "← Home" `Link` block that used to be copy-pasted across six
  page files. Every authenticated page now composes `<Header /><main>...</main><Footer />`;
  `/wall` (full-screen kiosk display), `/login`, and `/family-setup` (pre-family-membership
  flows) deliberately stay chrome-free. `app/page.tsx` now renders only the feature tiles plus
  `components/ClockWidget.tsx` (client, live day/date/time in browser-local time — same
  timezone approximation the dashboard/wall already use, not the family's IANA timezone) and
  `components/WeatherWidget.tsx` (client, polls `GET /api/weather` every 15 minutes).
  `lib/weather.ts`/`app/api/weather/route.ts` call Open-Meteo (no API key required) using
  `WEATHER_LAT`/`WEATHER_LON` env vars, defaulting to London to match `FamilyGroup.timezone`'s
  default. Family-profile editing, invite-code generation, and family-member management
  (`FamilyCalendarTitle`, `InviteCodeCard`, `FamilyMemberManager`) moved off the home page onto
  a new `/family` page; a new `/settings` page is a "Coming soon" placeholder reserved for
  future general app settings (distinct from `/family`'s household/member management).

**Not built yet:** Adult-membership management (removing another adult from the family).
Calendar has no calendar-integration sync (Google/Apple) and no per-occurrence recurrence
editing yet — both are explicitly future phases in the spec, not gaps in Phase 5. Routines
has no alternative-schedule holiday mode (§15.4's other option) — only the "disable"
behaviour described above.

Current domain model: `FamilyGroup` (≈ spec's `Family`) has `FamilyMember`s, `Todo`s,
`CalendarEvent`s, `Chore`s, `Routine`s, one `ShoppingList`, and `SpecialOccasion`s.
`SpecialOccasion` is the one domain table that hangs directly off `FamilyGroup` with no
`FamilyMember` relation at all — every other domain table below ties back to a `FamilyMember`
somewhere. Authenticated adults are
Better Auth `User`s linked to a `FamilyGroup` via `FamilyMembership` (one family per user for
now — multi-family
membership is explicitly out of scope) and, separately, to their own `FamilyMember` row via
`FamilyMember.linkedUserId` (one link, not a join table — an adult has exactly one card).
Children have a `FamilyMember` row only, no `User`/login. A `CalendarEvent` belongs to the
`FamilyGroup`, never to one person — `EventParticipant` is always the join table to one or
more `FamilyMember`s. A `Chore` similarly belongs to the `FamilyGroup`; its `ChoreSchedule`
assigns exactly one `FamilyMember`, and each day's `ChoreOccurrence` denormalizes
`familyGroupId` for the family+date index `DesignSpec.md` §25 calls for. A `Routine` belongs
directly to one `FamilyMember` (unlike `Chore`, where assignment lives on the schedule) plus
has its own `RoutineSchedule` and ordered `RoutineItem`s; each day's `RoutineOccurrence`
denormalizes `familyGroupId`/`familyMemberId` the same way `ChoreOccurrence` does, and its
`RoutineItemCompletion` rows track which items are ticked for that day.

When adding a feature from the design spec, verify against the actual schema and files
first — don't assume the spec-described code already exists.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # next build (Vercel prepends `npx prisma generate`)
npm run lint         # next lint (eslint-config-next)
npm test             # vitest run -- unit tests (lib/*.test.ts)
npm run test:watch   # vitest, watch mode
npx prisma db seed   # runs prisma/seed.ts via ts-node (upserts app_label)
```

Database changes:
```bash
npx prisma migrate dev --name <change>   # create + apply migration locally
npx prisma migrate deploy                # apply to Neon (uses DIRECT_URL)
npx prisma generate                      # regenerate client after schema edits
```

`npx prisma migrate dev` requires an interactive terminal and will refuse to run
non-interactively (including from an agent's shell) whenever it detects a rename or a
drop that would lose data — which is common once `LegacyUser`/Better Auth/`Invitation`-style
migrations are involved. In that situation, either run it yourself in a real terminal, or
hand-write the migration SQL (`prisma migrate diff --from-schema-datasource
prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, reviewed and
placed in a new `prisma/migrations/<timestamp>_<name>/migration.sql`) and apply it with
`npx prisma migrate deploy`, which doesn't prompt.

Vitest is configured (`vitest.config.ts`) but only covers unit-testable `lib/` modules so far
(`recurrence.test.ts`, `schemas.test.ts`, `authz.test.ts`) — no integration or end-to-end
runner exists yet (§43 of `DesignSpec.md`; see `docs/ROADMAP.md`).

See `docs/` for the maintained reference docs — `SPEC.md` (product baseline),
`ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `AUTH.md`, `ROADMAP.md` — kept up to date per §48;
prefer updating those over expanding this file's "Architecture notes" section further.

## Architecture notes that aren't obvious from a single file

- **Two connection strings, by design.** `schema.prisma` uses `url = DATABASE_URL` (pooled, PgBouncer — used by the running app) and `directUrl = DIRECT_URL` (direct — used by Prisma CLI for `migrate`/`seed`, because PgBouncer blocks the session-level commands the migration engine needs). In this repo both currently point at the same Neon database (there is no separate local Postgres) — in production they'd be Neon's pooled (`-pooler` in hostname) vs. direct strings. Migrations run against the direct URL — never route them through the pooler.

- **Prisma client is a singleton** (`lib/prisma.ts`) cached on `globalThis` outside production, to avoid exhausting connections under Next.js hot-reload. Always import `prisma` from `@/lib/prisma`; don't `new PrismaClient()` elsewhere. Standalone scripts that run outside the Next.js process (`prisma/seed.ts`, `scripts/migrate-legacy-users.ts`) are the intentional exception.

- **`@/*` path alias** maps to the repo root (`tsconfig.json`), so `@/lib/prisma`, `@/app/...`, etc. Standalone scripts run via `ts-node` don't resolve this alias, so they use relative/package imports instead (see `scripts/migrate-legacy-users.ts`).

- **DB failures degrade gracefully, not crash.** `app/page.tsx` catches DB errors and renders a fallback label + error string rather than throwing. Follow this pattern for the wall display — it must keep showing *something* even when the DB or network is down.

- **Auth and authorization (Phase 2 — see `docs/AUTH.md` for the full picture):** Better Auth (`lib/auth.ts` server instance, `lib/auth-client.ts` client) owns sign-up/sign-in/sessions, with custom `hash`/`verify` wired to `bcryptjs` (`lib/password.ts`) so pre-Better-Auth password hashes keep working. `lib/authz.ts`'s `requireSession()` is the single place API routes get `{ user, familyGroupId }` — it 401s if there's no session and 409s if the session exists but hasn't joined/created a family yet (see the `/family-setup` flow). `can()`/`requireCan()` are the centralized permission checks the design spec asks for (§6.2/§8); there's no role split to enforce yet, so every action currently just checks "is this user in a family."

- **Invitations are hashed, expiring, single-use** (`lib/invitations.ts`) — `Invitation.codeHash` is a SHA-256 hash, never the plaintext code; the plaintext is only ever returned once, in the API response at creation time. Don't add a way to "look up" or re-display an existing invite's plaintext code — mint a new one instead.

- **Vercel build regenerates the Prisma client** (`vercel.json` build command `npx prisma generate && next build`), so a schema change is picked up on redeploy with no manual step. When the design spec's realtime/cron features are built, related config goes in `vercel.json` too.

## Environment

Local `.env` needs `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (see
`.env.example`). The design spec lists many more vars for later-phase features (calendar
integrations, etc.) — only add/require them when building the corresponding feature.
