# Architecture

Next.js 14 (App Router, TypeScript, Tailwind), Prisma + Neon Postgres, deployed on Vercel.
No tRPC, no Server Actions for domain writes — every client/server interaction is `fetch`
from a client component to a Next.js Route Handler, orchestrated by TanStack Query. See
`docs/AUTH.md` for authentication/authorization detail and `docs/DATABASE.md`/`docs/API.md`
for the data and API layers this document sits above.

## Layers

```
Client component (React, "use client")
    |  fetch()
    v
Route handler (app/api/**/route.ts)
    |  requireSession() / requireCan()  -- lib/authz.ts
    |  schema.parse()                   -- lib/schemas.ts
    v
Domain/service layer (lib/calendar.ts, lib/chores.ts, lib/routines.ts, lib/shopping.ts)
    |  Prisma
    v
Postgres (Neon)
```

Todos, family members, and invitations are simple enough that their route handlers talk to
Prisma directly rather than through a dedicated `lib/*.ts` module (`docs/API.md` marks each
route's shape). Calendar, chores, and routines have a real service layer because they share a
pattern — a definition table plus generated/expanded per-day occurrences — non-trivial enough
to be worth naming and testing on its own. `lib/shopping.ts` also exists as a service layer
even though `ShoppingItem` has no occurrence concept, mainly for the lazy-create-on-first-use
`getOrCreateShoppingList` behaviour and to keep the route handler thin/consistent with the
others.

Every domain service function takes a `FamilyContext` (`{ user, familyGroupId }`, produced
only by `requireSession()`) as its first argument — this is what makes "which family does this
belong to" a compile-time-visible parameter instead of something re-derived ad hoc per query.
See `docs/DATABASE.md`'s "Family isolation" section for why this matters.

## Directory map

```
app/
  layout.tsx, providers.tsx     root layout; TanStack Query's QueryClientProvider
  page.tsx                      home: family settings, feature tiles, member manager
  login/, family-setup/         Better Auth sign-in/up, create-or-join-family flow
  todo/, calendar/, chores/,
  routines/, shopping/          one page per domain, each backed by a *Board component
  dashboard/                    Phase 9 combined view (lib/dashboardData.ts)
  wall/                         Phase 10 wall-mounted display (shares dashboard data/hooks)
  api/                          route handlers -- see docs/API.md
components/                     one *Board/*Modal/*Card per domain, plus shared chrome
                                 (FamilyCalendarTitle, LogoutButton, InviteCodeCard)
lib/
  prisma.ts                     PrismaClient singleton
  auth.ts, auth-client.ts,
  authz.ts, invitations.ts,
  password.ts                   Better Auth wiring + authorization -- docs/AUTH.md
  schemas.ts                    all Zod request/response schemas
  api-errors.ts                 ApiError + errorResponse
  realtime.ts                   polling-backed domain-event abstraction
  calendar.ts, chores.ts,
  routines.ts, shopping.ts      domain/service layer
  recurrence.ts                 RRULE build/parse/expand for calendar events
  calendarViewRange.ts          day/week/multi-day view-range math shared by the grid + dashboard
  dashboardData.ts,
  useDashboardQueries.ts,
  useIdleReturn.ts              Phase 9/10 dashboard+wall support
  familyMemberColors.ts,
  familyMemberAvatars.ts,
  calendarEventColor.ts         fixed palettes/derivations, no user-defined colours
middleware.ts                   Edge cookie-presence gate (real check happens per-page/route)
prisma/schema.prisma            see docs/DATABASE.md
```

## Server-rendered pages, then TanStack Query takes over

Every top-level page (`app/page.tsx`, `app/dashboard/page.tsx`, `app/wall/page.tsx`,
`app/todo/page.tsx`, etc.) is an async Server Component: it resolves the session, fetches the
initial data with Prisma directly (not through the API routes it also defines), and passes
that as `initial*` props into a client component, which seeds a `useQuery`'s
`initialData`/re-fetches from the API from then on. This means first paint has no client-side
loading spinner, and all subsequent interaction (mutations, polling, cache invalidation) is
ordinary TanStack Query. `app/page.tsx#getHomeData` is the pattern to follow: catch DB errors
and render a fallback rather than throwing — see "Failure handling" below.

`app/dashboard/page.tsx` and `app/wall/page.tsx` both call the same
`lib/dashboardData.ts#getDashboardData(ctx)` for their server-rendered initial data, and both
mount `lib/useDashboardQueries.ts#useDashboardQueries(...)` for the client-side half — so the
two views' TanStack Query caches stay coherent regardless of which is mounted (checking a todo
off on `/wall` is reflected on `/dashboard` without a hard refresh, and vice versa), and
neither view duplicates the other's fetch/mutation logic.

## Realtime: polling, with a stable seam

There's no WebSocket/SSE server. `lib/realtime.ts#subscribeToFamilyEvents()` returns a fixed
poll interval (4s) that components hand to TanStack Query as `refetchInterval`; mutating route
handlers call `publishDomainEvent({ type, familyGroupId })` after a successful write, which is
currently a no-op. This is the actual realtime strategy per `DesignSpec.md` §47's escalation
path, not a placeholder — the point of keeping `publishDomainEvent`/`subscribeToFamilyEvents`
as the only call sites is that swapping in SSE/WebSockets/a pub-sub provider later only
touches `lib/realtime.ts`, not every route handler and component that currently polls.

## Validation

Every request body and every date-range/date-only query param is parsed through a Zod schema
in `lib/schemas.ts` before a route handler uses it — there is one schema file for the whole
app, not one per domain, so a shape used by both a route and its tests (`lib/schemas.test.ts`)
has exactly one definition. Schemas are named `<domain><Create|Update|...>Schema` and mirror
the Prisma model they validate input for, but are hand-written rather than derived from the
schema (`zod-prisma` or similar) — see Rule 5 in `DesignSpec.md` §49 ("avoid duplication") for
why that tradeoff was accepted: the two are already kept in sync by hand across domain
service/route/schema, generation wasn't judged worth the added tooling.

## Errors

`lib/api-errors.ts` is the single error shape for the whole API: `ApiError(status, message)`
for domain failures a route throws deliberately, `ZodError` → 400 automatically, anything else
→ logged server-side and a generic 500. No route hand-builds an error `NextResponse` outside
this. See `docs/API.md`'s "Conventions" section for the full contract.

## Failure handling: degrade, don't crash

`app/page.tsx#getHomeData` catches a DB failure and renders a fallback label plus the error
string, rather than letting the page throw into Next's error boundary. This matters most for
the wall display (`app/wall/page.tsx`) — a tablet bolted to a wall should keep showing
*something* rather than a Next.js error screen when the DB or network hiccups. Follow this
pattern for any new page-level data fetch; it is not yet applied inside every client-side
`useQuery` (a failed background refetch on `/wall` currently just keeps showing stale data,
which is an acceptable degrade but worth knowing about before changing that code).

## Timezones

`FamilyGroup.timezone` (IANA, default `"Europe/London"`) drives server-side recurrence
expansion (`lib/recurrence.ts`, via Luxon) — the one place time zone correctness actually
matters, since a recurring event's occurrences are computed once on the server for everyone in
the family. Everywhere else (the calendar grid, "today" on the dashboard/wall,
`lib/calendarViewRange.ts`) renders in browser-local time, on the assumption that a household's
devices share the family's timezone. This is a deliberate simplification, not an oversight —
see `DesignSpec.md` §26 for the full rule and its rationale.

## Auth boundary

`middleware.ts` only checks for the presence of Better Auth's session cookie (Next.js 14
Edge middleware can't do a DB-backed session lookup) and redirects unauthenticated requests to
`/login`. The real check is `lib/authz.ts#requireSession()` (API routes, 401/409) and
`getCurrentUser()`/`getFamilyMembership()` (Server Components, redirect to `/login` or
`/family-setup`). See `docs/AUTH.md` for the complete picture, including why a valid session
can still have no family attached.

## Testing

Vitest (`vitest.config.ts`, `node` environment, `**/*.test.ts`, `@` alias resolved) covers
pure/unit-testable logic co-located with the module it tests: `lib/recurrence.test.ts`
(RRULE build/parse/expand), `lib/schemas.test.ts` (Zod schema edge cases), `lib/authz.test.ts`
(the `can()` permission matrix). Run with `npm test` (`npm run test:watch` for watch mode).
There is no integration or end-to-end test suite yet — API-route/family-isolation/auth-flow
coverage from `DesignSpec.md` §43 is still outstanding; see `docs/ROADMAP.md`.
