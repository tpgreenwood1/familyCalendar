# REST API

All routes are Next.js App Router route handlers under `app/api/`. There is no tRPC — plain
`fetch` from client components (via TanStack Query), JSON in and out. See `DesignSpec.md` §22
for the architectural rules this follows and §23 for the service/domain layer these routes sit
on top of.

## Conventions

- **Auth.** Every route except `GET /api/config`, `GET /api/weather`, and the Better Auth
  handler itself calls `requireSession()` (`lib/authz.ts`) first, which resolves the caller's
  Better Auth session
  into `{ user, familyGroupId }` — 401 if there's no session, 409 if the session exists but
  hasn't joined/created a family yet. `familyGroupId` always comes from this, never from the
  request. A mutating route additionally calls `requireCan(ctx, action)` (see "Authorization"
  below) before touching the database.
- **Validation.** Request bodies and query params are parsed with a Zod schema from
  `lib/schemas.ts` before use — `familyMemberCreateSchema`, `calendarEventCreateSchema`, etc.
  A failed parse becomes a 400 via `errorResponse` (below), so routes never hand-check `if
  (!body.name)`.
- **Errors.** Every handler is `try { ... } catch (error) { return errorResponse(error) }`.
  `lib/api-errors.ts#errorResponse` maps: an `ApiError(status, message)` → that status with
  `{ error: message }`; a `ZodError` → 400 with the first issue's message; anything else →
  logged server-side, 500 with a generic `{ error: "Something went wrong" }` (never leaks
  internals to the client). Routes throw `ApiError` directly for domain-specific failures
  (404 not found, 409 name-already-in-use, 403 forbidden) rather than returning ad hoc JSON.
- **Family scoping.** Every list/lookup query filters by `ctx.familyGroupId` (directly or via
  a relation), and every id-based mutation re-checks the target row belongs to that family
  before writing (e.g. `prisma.familyMember.findFirst({ where: { id, familyGroupId } })`) — an
  id from another family 404s rather than 403s, so existence isn't leaked either. See
  `docs/DATABASE.md`'s "Family isolation" section.
- **Realtime.** Mutating routes call `publishDomainEvent({ type, familyGroupId })`
  (`lib/realtime.ts`) after a successful write. Today that's a no-op — TanStack Query's
  polling `refetchInterval` is the actual "subscription" — but keeping the call sites in place
  means a future SSE/WebSocket upgrade only touches `lib/realtime.ts`. Not every route calls
  it yet (see the per-route lists below); that's a known gap, not a deliberate omission.

## Authorization

`lib/authz.ts` defines every mutating action as a member of the `Action` union
(`family.update`, `familyMember.manage`, `todo.manage`, `invitation.create`,
`calendarEvent.manage`, `chore.manage`, `choreOccurrence.manage`, `routine.manage`,
`routineOccurrence.manage`, `shoppingItem.manage`, `specialOccasion.manage`) and a single
`can(ctx, action)` predicate.
There is no ADULT/CHILD role split yet — `can()` currently returns `true` for every action for
any authenticated family member — but routes call `requireCan()` rather than assuming access,
so a role split can be added inside `lib/authz.ts` later without touching any route. The one
exception already enforced ad hoc, at the route level rather than in `can()`, is
`family-members`: an adult may edit only their own card, and only children can be deactivated
or removed (see below) — that's a per-row ownership check, not a permission-type check, which
is why it isn't in `can()`.

## Routes

### `GET /api/config`
No auth. Legacy: returns `{ label }` from the `AppConfig.app_label` row (kiosk-scaffold
leftover, unrelated to the rest of the app).

### `GET /api/weather`
No auth (weather isn't family-scoped data). Thin wrapper over `lib/weather.ts#fetchWeather`,
which calls Open-Meteo's `current_weather` endpoint (no API key) using `WEATHER_LAT`/
`WEATHER_LON` env vars (defaults to London). Returns `{ tempC, description, icon }`, or 502
with `{ error }` if the upstream call fails. Powers `components/WeatherWidget.tsx` on the home
page; response is cached 10 minutes (`fetch`'s `next.revalidate`).

### `POST /api/family/setup`
Auth required, **no** existing `FamilyMembership`. Body: `{ mode: "create", familyGroupName }`
or `{ mode: "join", inviteCode }` (`familySetupSchema`, a discriminated union on `mode`).
Creates or joins a `FamilyGroup`, then in one transaction creates the caller's
`FamilyMembership` and their linked `ADULT` `FamilyMember` card. On `create`, also mints a
fresh invite code so a brand-new family isn't left without one. Returns
`{ familyGroupId, inviteCode? }`, 201. 409 if the caller already belongs to a family.

### `GET/PATCH /api/family-group`
`GET`: session required, returns `{ name, holidayMode }`. `PATCH`: `requireCan("family.update")`;
body `familyGroupUpdateSchema`; publishes `FAMILY_GROUP_UPDATED`.

### `POST /api/invitations`
`requireCan("invitation.create")`. Mints a new `Invitation`, returns `{ code }` (plaintext,
shown once), 201. There is no "list/re-display an invite" endpoint by design — see
`docs/AUTH.md`.

### `GET/POST /api/family-members`
`GET`: session required; returns all members (adults first, then by `createdAt`), including
inactive ones so the manager UI can offer "Reactivate". `POST`: `requireCan("familyMember.manage")`;
body `familyMemberCreateSchema`; always creates `role: "CHILD"` (adults only get a card via
`/api/family/setup`); 409 if the name is already taken in the family.

### `PATCH/DELETE /api/family-members/[id]`
`requireCan("familyMember.manage")`, then a per-row ownership check on top: if the target is
an `ADULT`, the caller must be that adult (`linkedUserId === ctx.user.id`) to `PATCH`, and
`active` may not be changed on an adult at all; `DELETE` 403s on any `ADULT` target regardless
of caller. Both 404 if the id isn't in the caller's family. `PATCH` body:
`familyMemberUpdateSchema`; re-checks name uniqueness on rename.

### `GET/POST /api/todos`
`GET`: session required, returns the family's todos across all members. `POST`:
`requireCan("todo.manage")`; body `todoCreateSchema` (`text`, `userId` — must be a
`FamilyMember` in the caller's family, `priority?`); publishes `TODO_CREATED`.

### `PATCH/DELETE /api/todos/[id]`
`requireCan("todo.manage")`; 404 if the todo isn't in the caller's family (via
`familyMember.familyGroupId`). `PATCH` body `todoUpdateSchema`; publishes `TODO_COMPLETED` if
`completed` was included, else `TODO_UPDATED`. `DELETE` publishes `TODO_DELETED`.

### `GET/POST /api/calendar/events`
Thin wrappers over `lib/calendar.ts`. `GET`: session required; query `start`/`end` (ISO,
validated by `calendarEventRangeQuerySchema`) are required; returns expanded occurrences —
recurring events are already unrolled into per-instance objects for the range, not raw
`CalendarEvent` rows. `POST`: `requireCan("calendarEvent.manage")`; body
`calendarEventCreateSchema`.

### `PATCH/DELETE /api/calendar/events/[id]`
`requireCan("calendarEvent.manage")`; delegate to `lib/calendar.ts#updateCalendarEvent` /
`#deleteCalendarEvent`, which apply to the whole recurring series (no per-occurrence
edit/exclusion yet — see `docs/DATABASE.md`).

### `GET/POST /api/chores`
Thin wrappers over `lib/chores.ts#listChores`/`#createChore`. `POST`:
`requireCan("chore.manage")`; body `choreCreateSchema`. `createChore` stores `title`
capitalized regardless of input casing (`lib/textFormat.ts#capitalize`).

### `PATCH/DELETE /api/chores/[id]`
`requireCan("chore.manage")`; delegate to `lib/chores.ts#updateChore`/`#deleteChore`. The
`/chores/edit` page (filterable-by-member chore editing, kept separate from the main
`/chores` board) calls these same two routes — no dedicated edit-page API exists.

### `GET /api/chores/occurrences`
Session required. Optional `?date=YYYY-MM-DD` (`dateOnlySchema`); no date defaults to
today (in the family's timezone), **not** all occurrences for the family — always a single
day. Calls `generateChoreOccurrences` for that day itself before reading, so callers never
need to generate separately.

### `GET /api/chores/occurrences/week`
Session required, no params — always the current week (Monday-Sunday, family timezone).
Thin wrapper over `lib/chores.ts#listChoreOccurrencesForWeek`, which generates each of the
7 days' occurrences (same idempotent `generateChoreOccurrences` as the single-day route)
and returns `{ weekStart, occurrences }` for the whole family — callers filter to one
member client-side, same as the single-day route's whole-family result. Powers the
read-only per-member weekly overview (`/chores/[memberId]`, `ChoreWeekOverview.tsx`) —
see `DesignSpec.md` §13.8.

### `PATCH /api/chores/occurrences/[id]`
`requireCan("choreOccurrence.manage")`. Body `choreOccurrenceStatusSchema` (`status`:
`PENDING`/`COMPLETED`/`SKIPPED`); delegates to `lib/chores.ts#setChoreOccurrenceStatus`, which
never writes back to the `ChoreSchedule`.

### `GET/POST /api/routines`
Thin wrappers over `lib/routines.ts#listRoutines`/`#createRoutine`. `POST`:
`requireCan("routine.manage")`; body `routineCreateSchema`.

### `PATCH/DELETE /api/routines/[id]`
`requireCan("routine.manage")`; delegate to `lib/routines.ts#updateRoutine` (full
item-list replace, not a per-item diff) / `#deleteRoutine`.

### `GET /api/routines/occurrences`
Session required. Optional `?date=YYYY-MM-DD`, same shape as the chores equivalent.

### `PATCH /api/routines/occurrences/[id]/items/[itemId]`
`requireCan("routineOccurrence.manage")`. Body `routineItemCompletionSchema` (`completed:
boolean`); delegates to `lib/routines.ts#setRoutineItemCompletion`, which upserts/deletes the
`RoutineItemCompletion` row rather than flipping a flag.

### `GET/POST /api/shopping/items`
Thin wrappers over `lib/shopping.ts#listShoppingItems`/`#addShoppingItem`, which lazily
create the family's one `ShoppingList` on first use. `POST`: `requireCan("shoppingItem.manage")`;
body `shoppingItemCreateSchema` (`name`, `category` — `"GROCERIES" | "OTHER"`, optional,
defaults to `"GROCERIES"`). `addShoppingItem` stores `name` capitalized (first letter
uppercase, rest lowercase) regardless of the casing it was submitted in.

### `PATCH/DELETE /api/shopping/items/[id]`
`requireCan("shoppingItem.manage")`; delegate to `lib/shopping.ts#setShoppingItemChecked`/
`#deleteShoppingItem`.

### `GET/POST /api/special-occasions`
Thin wrappers over `lib/specialOccasions.ts#listSpecialOccasions`/`#createSpecialOccasion`.
`GET`: session required; returns every occasion for the family, sorted soonest-upcoming
first, each pre-annotated with `nextOccurrenceDate`/`daysUntil`/`isToday`/`computedYears` —
there is no separate "upcoming" endpoint; callers (the Dashboard card, the Wall tile) just
filter this same list to `daysUntil <= 7` client-side. `POST`:
`requireCan("specialOccasion.manage")`; body `specialOccasionCreateSchema`. Unlike
`createChore`/`addShoppingItem`, `title` is stored as submitted, with no capitalization
normalization — occasion titles are free-text phrases ("Mum's Birthday") that would be
mangled by "first letter upper, rest lower".

### `PATCH/DELETE /api/special-occasions/[id]`
`requireCan("specialOccasion.manage")`; delegate to
`lib/specialOccasions.ts#updateSpecialOccasion`/`#deleteSpecialOccasion`.

### `/api/auth/[...all]`
Better Auth's own handler (`toNextJsHandler(auth)`) — sign-up, sign-in, sign-out, session
endpoints. Not hand-written; see `docs/AUTH.md` for what's configured on the `auth` instance
(`lib/auth.ts`).

## On-demand generation, not cron

Neither `generateChoreOccurrences` nor `generateRoutineOccurrences` has an API route or a
`vercel.json` cron entry. Both are called on-demand, inside the `GET /api/chores/occurrences`
and `GET /api/routines/occurrences` handlers respectively (via `lib/chores.ts` /
`lib/routines.ts`), so occurrences for "today" get created the first time anything asks for
them rather than by a scheduled job. Both are idempotent (a DB unique constraint plus
`createMany({ skipDuplicates: true })`), so calling them on every occurrences `GET` is safe.

## Response shapes

Routes return the Prisma row shape directly for simple resources (`FamilyMember`, `Todo`,
`ShoppingItem`) and a service-layer DTO for anything that combines/derives data (calendar
occurrences, chore/routine occurrences, `FamilyGroup`'s `{ name, holidayMode }` projection).
There's no shared response envelope (no `{ data, meta }` wrapper) — a success response is the
resource itself, and every error response is `{ error: string }` with a non-2xx status, per
`errorResponse` above.
