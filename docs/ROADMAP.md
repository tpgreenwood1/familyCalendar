# Roadmap

Tracks implementation phases against `DesignSpec.md` §31 onward. `docs/ARCHITECTURE_AUDIT.md`
is the frozen Phase 0 snapshot (a point-in-time audit, not a living document); this file is the
living status. `CLAUDE.md`'s "Done so far" section carries the detailed *why* behind each
phase's decisions — this file is the shorter at-a-glance list.

## Done

| Phase | Spec § | Summary |
|---|---|---|
| 0 — Audit | §31 | `docs/ARCHITECTURE_AUDIT.md`: pre-rewrite architecture, schema, auth, technical debt. |
| 1 — Foundation | §32 | Zod (`lib/schemas.ts`), TanStack Query (`app/providers.tsx`), shared API error shape (`lib/api-errors.ts`), `can()`/`requireCan()` authorization (`lib/authz.ts`). |
| 2 — Better Auth | §33 | NextAuth fully replaced. Email/password auth, sessions, family creation, invite-code joining all on Better Auth. `docs/AUTH.md`. |
| 3 — Family Management | §34 | `FamilyMember` (role, avatar, dateOfBirth, active, linkedUserId) replaces `FamilyUser`. Signup/join creates a linked `ADULT` card. Adult roster is read-only except a member's own card; children fully manageable. |
| 4 — TODO Migration | §35 | `Todo` on the `FamilyMember` model, `priority` flag, optimistic completion. Realtime seam (`lib/realtime.ts`) implemented as polling. |
| 5 — Calendar | §36 | `CalendarEvent`/`EventParticipant`, `lib/calendar.ts`, `lib/recurrence.ts` (Daily/Weekly/Monthly presets as RRULE, Luxon expansion). Day/multi-day/week views share one `CalendarGrid`. Whole-series edit/delete only. |
| 6 — Chores | §37 | `Chore`/`ChoreSchedule`/`ChoreOccurrence`, `lib/chores.ts`. One schedule per chore, single assignee, fixed weekdays. Occurrences generated on-demand, idempotently. |
| 7 — Routines | §38 | `Routine`/`RoutineSchedule`/`RoutineItem`/`RoutineOccurrence`/`RoutineItemCompletion`, `lib/routines.ts`, same on-demand idempotent generation as Chores. `FamilyGroup.holidayMode` implements the "disable" half of §15.4 only. |
| 8 — Shopping | §39 | `ShoppingList`/`ShoppingItem`, `lib/shopping.ts`. One shared list per family, lazily created. No quantity/category/store. |
| 9 — Family Dashboard | §40 | `/dashboard`, `FamilyDashboard`/`MemberDashboardCard`. Read/combine layer over the five domains' existing service functions and query keys — no new domain logic. |
| 10 — Wall Display | §41 | `/wall`, `WallDisplay`. Shares `lib/dashboardData.ts`/`lib/useDashboardQueries.ts` with the dashboard. `lib/useIdleReturn.ts` for 30s auto-return-to-overview. Portrait-orientation CSS nudge. |
| 11 — Future Placeholders | §42 | `FuturePlaceholderTiles` (Rewards, Meal Planning) — disabled, visual-only tiles on both Dashboard and Wall. |
| 48 — Documentation | §48 | This file plus `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`, `docs/SPEC.md`; `docs/AUTH.md` and `docs/ARCHITECTURE_AUDIT.md` predate this pass and are unchanged. |

## In progress

- **Testing Strategy (§43).** Vitest is wired up (`vitest.config.ts`, `npm test`) with unit
  coverage for `lib/recurrence.ts`, `lib/schemas.ts`, and `lib/authz.ts`'s permission matrix.
  Not yet built: integration tests (API endpoints, family isolation, occurrence generation)
  and the end-to-end flows §43 lists (auth, family, todo, calendar, chores, routines,
  shopping). "Users cannot access another family's data" has no automated test yet — it's
  enforced by the query-shape convention in `docs/DATABASE.md`'s "Family isolation" section,
  not verified by a test.

## Not built yet

- **Adult-membership management** — removing or editing another adult's `FamilyMember` card
  (§34's "manage adult membership"). Currently an adult can only edit their own card; removing
  any adult is a hard 403 at `DELETE /api/family-members/[id]`.
- **Per-occurrence recurrence editing** (§10.5) — editing or deleting one instance of a
  recurring `CalendarEvent` always applies to the whole series; no exception/exclusion model
  exists yet.
- **Calendar integrations** (Google/Apple/Outlook, §29) — architected for (a `CalendarEvent`
  belongs to the family, not any external system) but not implemented.
- **Routines' alternative holiday schedule** (§15.4's second option) — only the "disable"
  behaviour is built; `RoutineSchedule.activeDuringHoliday` is the only data-model hook so far.

## Explicitly out of scope (§29/§30)

Not on this roadmap at all, by design: messaging, event invitations/attachments, notifications
(push/browser/email), rewards engine (points/redemption/approval), meal planning
implementation, child accounts/PINs, multiple-family membership, external guests, AI features,
chore rotation, missed-chore reporting, approval workflows. Several of these have a deliberate
placeholder or data-model hook (see `docs/DATABASE.md` and the "Future Placeholders" tiles)
precisely so adding them later doesn't require a schema change — but building the feature
itself is out of scope until a future spec revision says otherwise.
