# Product Specification

Product requirements baseline for the household platform. `DesignSpec.md` (repo root) is the
full, authoritative source this is distilled from — read it for anything not covered here,
especially the numbered phase-by-phase implementation plan (§31+, tracked day-to-day in
`docs/ROADMAP.md`) and the coding-agent rules (§49). This file exists so `docs/` alone answers
"what is this product for" without requiring the 2000-line original; when the two disagree,
`DesignSpec.md` wins and this file should be corrected to match.

## 0. What this is

A household platform in the spirit of Skylight Calendar: a shared family calendar, individual
TODOs, recurring chores, per-person routines, a shared shopping list, a combined family
dashboard, and a wall-mounted tablet display — deliberately simpler than a full Skylight
clone, built on a domain model and architecture that can grow into one. It replaces an earlier
todo-list prototype; the rewrite proceeds phase by phase (`docs/ROADMAP.md`).

## 1. Product vision

Not "a calendar app" — a view of **what the household needs to know and do today**. The
eventual wall display brings together what's happening today, what each family member needs
to do, which chores are outstanding, which routines are being completed, and what needs
buying. The UX should feel calm, visual, simple, and family-friendly. "The day" is the central
organising concept, not a list or an inbox.

The system must work as: a desktop/laptop web app (development and administration), a
phone/tablet app (responsive web), and a wall-mounted shared touchscreen display. A native
mobile app is a possible future addition, not part of V1.

## 2. Technology baseline

Next.js (App Router, TypeScript), Vercel, Neon PostgreSQL, Prisma, Tailwind CSS, REST APIs via
Next.js route handlers — retained from the pre-rewrite app. Introduced by the rewrite: Better
Auth, TanStack Query, Zod, automated testing. Avoid introducing anything else (a new ORM,
GraphQL, a state-management library, a component library beyond what's already adopted)
without a compelling reason — see `docs/ARCHITECTURE.md` for what's actually in place today.

## 3. Implementation principles

1. **Family-first.** All household data belongs to a `FamilyGroup` (the spec's `Family`).
   Domain features are built around the family, not around an individual authenticated `User`.
2. **`User` and `FamilyMember` are different concepts.** A `User` is an authenticated account.
   A `FamilyMember` is a person in the household. Adults normally have both, linked; children
   have a `FamilyMember` only. The architecture must allow linking a child's `FamilyMember` to
   a `User` later (a PIN/simplified account) without a domain redesign — see
   `docs/DATABASE.md`.
3. **Definition, schedule, occurrence are distinct**, for anything recurring (chores,
   routines). Never mutate a recurring definition just to record one day's completion or
   skip — see `docs/DATABASE.md`'s Chores/Routines sections for how the schema enforces this.

## 4. Domain model (baseline)

```
User (Better Auth account)
  -> FamilyMembership -> FamilyGroup
                            +-- FamilyMember (adult, linked to a User)
                            +-- FamilyMember (adult, linked to a User)
                            +-- FamilyMember (child, no User)
                            +-- CalendarEvent (-> EventParticipant -> FamilyMember)
                            +-- Todo (-> one FamilyMember)
                            +-- Chore (-> ChoreSchedule -> one FamilyMember; -> ChoreOccurrence per day)
                            +-- Routine (-> one FamilyMember; -> RoutineSchedule; -> RoutineOccurrence per day)
                            +-- ShoppingList (-> ShoppingItem)
```

Full field-level detail, including why each table is shaped the way it is, lives in
`docs/DATABASE.md`.

## 5. Feature baseline

Each of these is authoritative for what V1 commits to; `docs/ROADMAP.md` tracks build status
against it.

- **Family & accounts.** Email/password sign-up via Better Auth. Creating a family or joining
  one by invite code are separate actions from account creation — a session can validly exist
  signed-in-but-no-family. One adult belongs to exactly one family. Household roster shows
  adults and children; an adult can edit only their own card; children are fully manageable by
  any adult. Removing another adult from the family is explicitly deferred.
- **Household invitation.** Single-use, expiring (7 day), hashed invite codes — never a
  permanent shared plaintext code. Rate-limited join attempts.
- **Authorisation.** Centralized `can()`/`requireCan()` checks per action, family-scoped. No
  ADULT/CHILD permission split yet — every family member currently has full access within
  their own family — but every route calls through the check so a split can be added later
  without touching call sites.
- **Calendar.** Shared family calendar; an event belongs to the family, never to one person,
  with one or more participants. Day/multi-day/week views. Simple recurrence (Daily/Weekly/
  Monthly presets); per-occurrence edit/exclusion is future. Colour is derived from
  participants, not user-chosen per event.
- **TODOs.** Per-member lists, optional priority flag, optimistic completion. No due dates in
  V1.
- **Chores.** A household responsibility definition with one schedule (single assignee, fixed
  weekdays) generating a `PENDING`/`COMPLETED`/`SKIPPED` occurrence per applicable day.
  Completing/skipping never edits the schedule. No rotation, points, or approval workflow.
- **Routines.** A named, ordered checklist for one family member (e.g. "Morning"), with its own
  schedule, resetting daily via occurrences whose items are ticked/unticked independently.
  Household-wide holiday mode can disable a routine's occurrences; a per-routine opt-out
  exists, but an *alternative* holiday schedule is not yet built.
- **Shopping list.** One shared list per family, add/check/uncheck/delete. No quantity,
  category, or store.
- **Family dashboard.** A combined, per-member view of today's chores, routines, and
  incomplete todos, plus today's calendar events and the shopping list — a read/combine layer
  over the other domains' existing data, not new domain logic.
- **Wall display.** A full-screen, always-on view for a mounted tablet: clock/date, compact
  per-member tiles, a horizontally-scrolling today's-events strip, a shopping tile. Tapping a
  tile opens a large-format focus view that auto-returns to the overview after 30s idle.
  Assumes an indefinite kiosk session — no repeated login.
- **Realtime.** Family-scoped data refreshes automatically across devices. Implemented as
  short-interval polling today, behind an abstraction (`lib/realtime.ts`) designed so a future
  SSE/WebSocket upgrade doesn't require changing call sites.

## 6. Definition of done (per feature)

A feature is done when: the domain model matches the spec (or a documented, deliberate
deviation), the service/domain layer enforces family scoping and validation, the API follows
the conventions in `docs/API.md`, the UI works across desktop/tablet/wall-display contexts it
applies to, and (per the Testing Strategy, `docs/ROADMAP.md`) relevant tests exist. Docs
(`CLAUDE.md`, this file, and the rest of `docs/`) are updated when the implementation
materially changes what they describe — per §48/§49 of `DesignSpec.md`, stale documentation is
treated as a defect, not a formality.

## 7. Deliberately out of scope

Messaging, event invitations/attachments, push/browser/email notifications, a rewards/points
engine, meal planning implementation, child PIN accounts, multiple-family membership, external
guests, AI features, chore rotation, missed-chore reporting, approval workflows,
Google/Apple/Outlook calendar sync. Some of these have an intentional architectural hook (see
`docs/DATABASE.md`) so they can be added later without a schema change — that is not the same
as being planned for the current baseline. Full list and rationale: `DesignSpec.md` §29/§30.
