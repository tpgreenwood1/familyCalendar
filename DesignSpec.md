# Family Calendar & Household Management App — Product + Technical Specification

## 0. Purpose

This document is the authoritative starting specification for upgrading the existing family-management application into a household platform inspired by the functionality and general UX of the Skylight Calendar.

The coding agent should be able to begin implementation using this document without requiring additional product clarification.

The existing application is a Next.js App Router application running on Vercel, backed by Neon PostgreSQL and Prisma. It currently contains basic authentication using NextAuth.js v5 and a TODO feature.

The target application will provide:

- Family/household management
- Shared family calendar
- Individual TODO lists
- Recurring chores
- Family-member routines
- Shared grocery/shopping list
- Family dashboard
- Wall-mounted tablet display mode
- Responsive access from phones, tablets and laptops
- Realtime synchronisation across devices

The product should be deliberately simpler than a full Skylight clone initially. Build a solid domain model and architecture that can support future features without implementing unnecessary functionality now.

---

# 1. Product Vision

The application is a shared **family operating system**.

The central concept is not simply "a calendar app". It is a view of **what the household needs to know and do today**.

The eventual wall-mounted display should bring together:

- What is happening today
- What each family member needs to do
- Which chores are outstanding
- Which routines are being completed
- What needs buying

The application should feel calm, visual, simple and family-friendly, with a UX broadly inspired by Skylight Calendar.

The "day" is the central organising concept.

The system must work well as:

1. A desktop/laptop web application during development and administration.
2. A phone/tablet application through responsive web UI.
3. A wall-mounted shared touchscreen display.

A future native/mobile supporting application may be added, but is not part of the initial implementation.

---

# 2. Current Technology

Retain the existing core stack unless there is a compelling technical reason not to.

## Required technology

- Next.js
- App Router
- TypeScript
- Vercel
- Neon PostgreSQL
- Prisma ORM
- Tailwind CSS
- REST APIs using Next.js route handlers

## Introduce

- Better Auth
- TanStack Query
- Zod
- shadcn/ui where appropriate
- Automated testing appropriate to the existing project

## Do not introduce unnecessarily

Do not add:

- tRPC
- a second ORM
- a second database
- a large state-management framework
- microservices
- unnecessary infrastructure
- a complex event-bus architecture

The application should remain a well-structured modular monolith.

---

# 3. Existing Application

Before changing application behaviour, inspect the current repository.

Known current structure includes:

- `app/` directory
- `layout.tsx`
- `page.tsx`
- `app/api/` route handlers
- REST APIs including:
  - config
  - auth/[...nextauth]
  - auth/signup
  - family-users
  - family-users/[id]
  - family-group
  - todos
  - todos/[id]

Current frontend:

- Next.js App Router
- Tailwind
- no Server Actions
- no tRPC
- no TanStack Query
- no shadcn/ui

Current authentication:

- NextAuth.js v5

Current database:

- Neon PostgreSQL
- Prisma

Current TODO feature:

- Each family member has a TODO list.
- Items can be added.
- Items can be deleted.
- Items can be checked as completed.

The implementation should first audit the existing code and then migrate incrementally rather than destroying the current application.

---

# 4. Implementation Principles

## 4.1 Family-first architecture

All household data belongs to a `Family`.

Do not build domain features around an individual authenticated User.

The basic hierarchy is:

    User
      |
      | authenticated adult account
      v
    FamilyMembership
      |
      v
    Family
      |
      +-- FamilyMember (adult)
      |
      +-- FamilyMember (adult)
      |
      +-- FamilyMember (child)
      |
      +-- CalendarEvent
      +-- Todo
      +-- Chore
      +-- Routine
      +-- ShoppingList

## 4.2 User and FamilyMember are different concepts

An authenticated `User` represents an account.

A `FamilyMember` represents a person in the household.

Adults normally have:

    User + FamilyMembership + FamilyMember

Children initially have:

    FamilyMember only

A future phase may give children authenticated accounts or PIN-based access.

The architecture must support linking a child FamilyMember to a User later without redesigning the domain.

## 4.3 Recurring definition vs occurrence

Recurring objects must distinguish between:

1. Definition
2. Schedule
3. Occurrence

This is particularly important for chores and routines.

Example:

    Chore:
        Empty dishwasher

    Schedule:
        Monday-Friday
        Assigned to Emma

    Occurrence:
        Friday 29 August
        Emma
        PENDING

Do not create/edit recurring definitions simply to handle a single day's completion or skip.

---

# 5. Family and Accounts

## 5.1 Initial assumptions


- One family/household has multiple users.
- Adults have full accounts.
- Children initially do not have accounts.
- Only household members have access.
- One adult belongs to one family for now.
- A family member has a role of adult or child.
- Adults have full read/write access.
- Children have read access plus the ability to check/complete appropriate items.
- External guests are not supported initially.

## 5.2 Family

A Family should contain at least:

- id
- name
- createdAt
- updatedAt

Example:

    Greenwood Family

## 5.3 FamilyMember

FamilyMember should contain at least:

- id
- familyId
- name
- role
- avatar
- colour
- dateOfBirth or equivalent optional age information
- linkedUserId nullable
- active
- createdAt
- updatedAt

Roles:

    ADULT
    CHILD

Do not require a child to have an email address or login.

## 5.4 Family membership

Authenticated users must have explicit membership of their family.

Do not infer family membership from arbitrary object ownership.

Every family-scoped API operation must establish the current user's family and authorisation before accessing data.

---

# 6. Authentication — Better Auth

Replace NextAuth.js v5 with Better Auth.

Use Better Auth as the authentication/session system and Prisma/PostgreSQL as the persistence layer.

The target authentication model is:

- email/password
- persistent sessions
- sign in
- sign out
- registration
- family creation
- household invitation by code

Do not implement initially:

- email verification
- password reset
- Google sign-in
- Apple sign-in
- passkeys
- child login
- external guests

These are future features.

## 6.1 Authentication migration

Do not delete NextAuth until Better Auth is working.

Process:

1. Audit current NextAuth implementation.
2. Document current user/session schema.
3. Determine existing user data.
4. Add Better Auth.
5. Implement Better Auth sessions.
6. Implement sign-in/sign-out.
7. Implement registration.
8. Implement family creation.
9. Implement family membership.
10. Migrate existing users/data safely.
11. Verify existing TODO ownership.
12. Remove NextAuth routes/dependencies once migration is complete.

Do not lose existing user or TODO data.

## 6.2 Better Auth organisation concept

Use Better Auth's organisation/membership capabilities where useful for authenticated adult membership.

However, application-level `Family` and `FamilyMember` remain the authoritative domain concepts.

Do not make the entire application dependent on Better Auth-specific organisation APIs.

Create an application-level authorisation abstraction.

For example:

    can(user, "calendar.read", family)
    can(user, "calendar.update", family)
    can(user, "chore.complete", chore)

The exact implementation may differ, but permission checks must be centralised.

---

# 7. Household Invitation

Initial invitation mechanism:

    Invite code

Example:

    K7P4-X92L

One adult creates an invitation and another adult uses the code.

Invitation data should include approximately:

- id
- familyId
- createdBy
- code hash
- createdAt
- expiresAt
- usedAt
- usedBy

Never store reusable invitation codes in plain text if avoidable.

Invitation codes should:

- have sufficient entropy
- expire
- be single-use
- be invalidated after successful use
- be rate limited

Email invitations are future functionality.

---

# 8. Authorisation

Centralise permission checking.

## Adult

Adults can:

- read family data
- create calendar events
- edit calendar events
- delete calendar events
- create/edit/delete TODOs
- complete TODOs
- create/edit/delete chores
- complete/skip chores
- create/edit/delete routines
- complete routine items
- manage family members
- manage family settings
- manage shopping list

## Child

Children will eventually have:

- calendar read
- TODO read
- TODO complete
- chore read
- chore complete
- routine read
- routine complete
- shopping list read

Initially children do not have authenticated accounts, so these permissions mainly establish the future model.

Do not scatter role checks throughout components.

---

# 9. Domain Model

At minimum, design the Prisma schema around these concepts.

## Core

- User — Better Auth managed
- Family
- FamilyMembership
- FamilyMember

## Calendar

- CalendarEvent
- EventParticipant

## TODO

- Todo

## Chores

- Chore
- ChoreSchedule
- ChoreOccurrence

## Routines

- Routine
- RoutineSchedule
- RoutineItem
- RoutineOccurrence
- RoutineItemCompletion

## Shopping

- ShoppingList
- ShoppingItem

Future concepts may include:

- Reward
- RewardRedemption
- ExternalCalendarConnection
- ExternalCalendarEvent
- Notification
- ChildAccount

Do not implement future models unless needed to keep referential integrity clean.

---

# 10. Calendar

## 10.1 V1 requirements

Calendar events must support:

- title
- start date/time
- end date/time
- all-day
- recurring events
- participants
- person colour coding
- location
- notes
- created by
- edit
- delete
- event detail view

Events belong to the Family.

## 10.2 Participants

Do not model an event as belonging to one person.

Use:

    CalendarEvent
        |
        +-- EventParticipant
                |
                +-- FamilyMember
                +-- FamilyMember

Example:

    Football
    18:00

    Participants:
        Jack
        Mum

This supports the desired Skylight-style visualisation where an event can display the colours/profile indicators of several family members.

## 10.3 Event detail

Selecting an event should open a detail view/modal showing:

- title
- date
- start/end time
- participants
- location
- notes

Example:

    Football
    Friday 18:00-19:00

    Jack
    Mum

    Leeds United Academy

    Notes:
    Take football boots
    Mum taking

## 10.4 Calendar views

Implement:

### Day

Single day timeline.

### Multi-day

Configurable multi-column display.

Target:

- 3-5 days depending on available width.

### Week

Seven-day view.

The calendar rendering engine should be independent from the wall-display layout so that the wall dashboard can present calendar information differently.

## 10.5 Recurrence

V1 must support recurring events.

Use a standards-based recurrence representation where practical, such as an RRULE-compatible design.

Do not implement complex recurrence exceptions unless required by the initial UX.

Future phase:

- edit one occurrence
- edit series
- exclude individual occurrence
- advanced recurrence rules

---

# 11. Calendar Colour

Family members should have a configurable colour.

The visual appearance of an event should be derived from its participants.

For one participant:

    solid member colour

For multiple participants:

    multi-colour/striped treatment

Do not permanently duplicate the member colour into each event if it can be derived reliably.

Changing a family member's colour should update how events are displayed.

---

# 12. TODOs

TODOs represent specific, generally one-off actions.

They are intentionally different from chores and routines.

## V1

Each family member has their own TODO list.

A TODO contains approximately:

- id
- familyId
- assignedToFamilyMemberId
- title
- completed
- priority
- createdAt
- updatedAt

## Behaviour

Users can:

- add
- edit
- delete
- complete/uncomplete
- mark as priority

Priority items should:

- move to the top of the list
- have distinctive styling

TODOs are not time-bound in V1.

Do not implement initially:

- due dates
- recurring TODOs
- reminders
- categories
- subtasks
- task history
- personal/family task types

Completed TODOs should preferably remain as records with `completed=true` rather than immediately being hard deleted. The UI may hide them or display them in a completed section.

This preserves future flexibility.

---

# 13. Chores

Chores are recurring household responsibilities.

Conceptually:

    TODO:
        "Buy birthday present for Sam"

    Chore:
        "Empty dishwasher"
        repeated Monday-Friday

Do not model chores simply as TODOs.

## 13.1 Chore definition

A Chore should contain:

- id
- familyId
- title
- active
- optional description
- createdAt
- updatedAt

## 13.2 Chore schedule

A ChoreSchedule should define:

- chore
- assigned FamilyMember
- applicable days
- optional effective start/end dates if useful

V1 supports:

- individual days
- grouped weekdays
- weekends
- manually specified assignment

Do not implement rotation initially.

## 13.3 Chore occurrence

Each scheduled occurrence should have:

- choreId
- familyMemberId
- date
- status
- completedAt
- skippedAt if useful

Statuses:

    PENDING
    COMPLETED
    SKIPPED

## 13.4 Daily generation

The system must automatically determine today's applicable chores.

Avoid blindly creating duplicates.

Generation must be idempotent.

For example:

    generateChoreOccurrences(familyId, date)

may safely be called repeatedly without creating duplicate occurrences.

## 13.5 Skip today

Skipping today must affect the occurrence, not the recurring definition.

Example:

    Empty dishwasher
    Every weekday

Today's occurrence:

    SKIPPED

Tomorrow:

    PENDING

## 13.6 V1 exclusions

Do not implement initially:

- points
- rewards
- approval
- missed-chore tracking
- rotation
- temporary reassignment
- completion history UI (multi-week history/reporting — see §13.8 for the one exception:
  a read-only view of the *current* week only)
- age-based filtering

## 13.7 Adding & editing chores (UI)

- Chore titles always display capitalized (first letter uppercase, rest lowercase)
  regardless of the casing they were entered in.
- When adding a chore, offer a fixed list of common household chores to pick from
  (e.g. "Empty dishwasher", "Make bed", "Walk the dog"), plus a "Custom…" option that
  reveals a free-text field for anything not on the list.
- Editing an existing chore (title, assignee, schedule, active/inactive, delete) happens
  on a separate "Edit chores" page, reached from the main Chores page, so the main page
  stays focused on today's view. The edit page is filterable by family member.

## 13.8 Weekly overview (per member)

- Clicking a family member's name on the main Chores page opens a read-only weekly
  overview for that member: the current week only (Monday-Sunday), with no navigation to
  past/future weeks.
- Shows each day of the week and that member's chores set for that day, with status
  (pending/completed/skipped) — a glance view, not an editable one. Completing or
  skipping a chore still only happens from the main Chores page.
- This is deliberately narrow in scope (current week only) and does not conflict with
  §13.6's exclusion of completion history UI, which is about multi-week
  history/reporting.

---

# 14. Future Rewards

Rewards are a planned Phase 2 feature.

Concept:

    Completing all core chores in a day
        ->
    child receives a star

Stars can eventually be redeemed for parent-defined rewards.

Example:

    Pottery Painting
    50 stars

A future model may contain:

    Reward
        name
        starsRequired
        active

and a child star balance/ledger.

Do not build the rewards engine now.

A disabled/placeholder dashboard tile for:

    ⭐ Rewards

may be included if it fits naturally into the UI.

Do not let the placeholder complicate the current domain model.

---

# 15. Routines

Routines are structured repeated activities for a family member.

They are different from TODOs.

Examples:

    Morning
    After School
    Evening

A routine is not initially a timer-driven workflow.

## 15.1 V1 routine behaviour

Support:

- routines per family member
- different routines for different days
- weekday/weekend differences
- school-day vs holiday behaviour
- routine items
- tick/check completion
- morning/afternoon/evening grouping

Do not initially support:

- timers
- automatic task generation into TODOs
- "next thing" display
- progress animation
- complex dependencies

## 15.2 Routine model

Conceptually:

    Routine
       |
       +-- RoutineSchedule
       |
       +-- RoutineItem

and daily:

    RoutineOccurrence
       |
       +-- RoutineItemCompletion

This separates the reusable routine definition from today's completion state.

## 15.3 Routine periods

Initial periods:

    MORNING
    AFTERNOON
    EVENING

Future periods can be added if useful:

    BEFORE_SCHOOL
    BEDTIME
    WEEKEND_MORNING

Do not assume exact times are required.

## 15.4 School holidays

Support a household/family holiday mode.

The exact holiday calendar does not need to integrate with external school calendars initially.

A simple family-level mode is sufficient.

When holiday mode is active, routines can either:

- be disabled
- use an alternative schedule

The data model should allow both, but V1 UI can start with disabling normal school-day routine requirements.

---

# 16. Shopping/Grocery List

Add a simple shared family grocery list.

Do not model it as TODOs.

Model:

    ShoppingList
        |
        +-- ShoppingItem

V1:

- one shared family shopping list
- add item
- check item
- uncheck item
- delete item
- display unchecked items prominently
- completed items can be visually separated
- every item sorts into exactly one of two fixed columns, "Groceries" or "Other Items",
  chosen when the item is added (default "Groceries")
- item names display capitalized (first letter uppercase, rest lowercase) regardless of
  the casing they were typed in — e.g. "MILK" and "milk" both display as "Milk"

Example:

    GROCERIES              OTHER ITEMS

    ☐ Milk                 ☐ Batteries
    ☐ Bread                ☐ Washing powder
    ☐ Apples
    ☑ Chicken

Future:

- multiple lists
- user-defined/custom categories (beyond the fixed Groceries / Other Items split)
- quantities
- recurring shopping
- stores
- meal planning integration

---

# 16A. Special Occasions

A year-round overview of birthdays and anniversaries — recurring yearly events, but not tied
to a weekday schedule the way Chores/Routines are.

Do not model it as a Chore/Routine-style definition+schedule+occurrence trio. Nothing here is
ever completed or skipped, so there is no per-day state to generate or persist — "next
occurrence", "days until", and "years since"/"turning N" are computed on every read instead
(`lib/specialOccasions.ts`).

Model:

    FamilyGroup
        |
        +-- SpecialOccasion   (no FamilyMember relation)

V1:

- standalone entries only — a `SpecialOccasion` is not linked to any `FamilyMember` or to
  `FamilyMember.dateOfBirth`. A free-text `title` covers anyone: a family member, a
  grandparent, a pet, or a deceased relative
- each occasion has a `title`, a `type` (`BIRTHDAY` or `ANNIVERSARY`), and one full date (the
  actual birth/wedding/death date, year included) — the year of that date doubles as the
  "initiating year" used to compute the age/years-since number, so there is no separate year
  field
- a `isSomber` flag distinguishes a happy occasion (a birthday, a wedding anniversary) from a
  somber one (e.g. a death anniversary/"In Memory of…"). This is **display-only** — it changes
  icon/wording, never suppresses the entry or gives it lower prominence than a happy one
- a dedicated page lists every occasion for the family, sorted by soonest-upcoming (wrapping
  across the year boundary), with add/edit/delete
- the Family Dashboard and Wall Display each surface a 7-day-window digest: occasions due
  within the next 7 days ("Mum's Birthday in 6 days"), and today's occasions get their own
  phrasing ("It's Mum's Birthday Today!" / "Today marks 3 years since Grandpa passed")

Future (explicitly out of scope for V1):

- reminders/notifications (push/email) ahead of an occasion
- linking an occasion to a `FamilyMember` (e.g. to reuse their avatar/color)
- gift ideas/tracking

---

# 16B. Photo Screensaver

A full-screen rotating photo display, usable two ways:

1. **Automatic** — on the Wall Display, after a configurable period of total inactivity, the
   screen switches to a full-screen slideshow of a chosen album. Any touch dismisses it back
   to whatever the wall was showing before.
2. **Manual** — a "Photos" tile on the Family Dashboard and Wall Display opens the same
   slideshow on demand, without waiting for the idle timer.

Do not build this as a sync from an external photo service (the previous spec's Google
Photos → Cloudflare R2 design no longer applies — see `DesignSpec-old.md`). Photos are
uploaded directly by family members and stored in Vercel Blob, which is native to the
existing Vercel deployment: no OAuth, no separate cloud account, no sync job. Direct
browser-to-Blob uploads also avoid the platform's serverless function body-size limit, which
matters for photo files.

Model:

    FamilyGroup
        |         \
        |          +-- screensaverEnabled / screensaverAlbumId / screensaverIntervalSeconds /
        |              screensaverIdleSeconds   (household-wide settings, same shape as
        |              holidayMode -- flat fields on FamilyGroup, not a separate settings table)
        |
        +-- PhotoAlbum
                |
                +-- Photo   (Vercel Blob URL + pathname; no binary data in Postgres)

V1:

- a family can have multiple named albums; each `Photo` belongs to exactly one album
- a dedicated page lists albums, lets members create/rename/delete an album, and
  upload/delete photos within one (drag-and-drop or file picker)
- household-wide screensaver settings choose **one** album as "the screensaver album", an
  interval in seconds between photos, and an idle delay (Wall Display only) before the
  slideshow auto-starts
- deleting the album currently selected for the screensaver disables the screensaver rather
  than leaving it pointing at nothing
- no role split to enforce yet (matching every other domain) — any signed-in family member
  can manage albums/photos and change screensaver settings

Explicitly out of scope for V1:

- syncing from Google Photos, iCloud, or any other external photo service
- multiple albums rotating together, or per-member/per-day album selection
- video, live photos, or facial recognition/tagging
- server-side thumbnailing/resizing pipeline — Blob serves originals directly

---

# 17. Family Dashboard

The dashboard is the central product experience.

It should bring together:

1. Calendar
2. Today's TODOs
3. Today's chores
4. Today's routines
5. Shopping list
6. Family status/progress where useful

The dashboard should be usable on desktop and touch devices.

The wall display will use a specialised dashboard layout.

---

# 18. Wall Display Mode

The wall tablet is a first-class client.

Do not treat it merely as a desktop website scaled down/up.

Create a display mode, for example:

    Standard
    Wall Display

Wall mode should support:

- landscape orientation
- large touch targets
- readable typography from a distance
- minimal navigation
- family dashboard
- today's calendar
- today's tasks
- today's chores
- routines
- shopping list
- realtime updates
- automatic return to dashboard after inactivity if appropriate

Avoid tiny desktop controls.

Touch targets should be comfortably usable by children.

The wall display should not require repeated full email/password authentication for every interaction.

Future child PIN/authentication can improve this.

---

# 19. Responsive Design

Design for:

### Desktop

- laptop development/admin

### Tablet

- normal tablet use
- wall display

### Mobile

- phone use
- eventual supporting mobile app

Use responsive components rather than creating entirely separate applications.

The wall mode may have a specialised layout.

---

# 20. Realtime Synchronisation

Realtime synchronisation is a core requirement.

Example:

    Mum completes a chore on phone
        |
        v
    API mutation
        |
        v
    PostgreSQL
        |
        v
    realtime event
        |
        v
    wall display updates immediately

This applies to:

- calendar events
- TODOs
- chores
- routines
- shopping items

The application should not depend solely on manually refreshing pages.

## Implementation approach

Design a realtime abstraction rather than hard-coding a provider throughout the UI.

For example:

    publishDomainEvent(...)
    subscribeToFamilyEvents(...)

Initially evaluate/use Vercel WebSocket support where appropriate.

If this proves unsuitable for reliable cross-instance realtime behaviour, use an external realtime service such as Ably rather than building a custom distributed realtime system.

The UI should receive domain changes and invalidate/update TanStack Query cache.

---

# 21. TanStack Query

Introduce TanStack Query for client-side server state.

Use it for:

- fetching family data
- calendar events
- TODOs
- chores
- routines
- shopping items
- mutations
- cache invalidation
- optimistic updates where safe
- realtime-triggered updates

Avoid duplicating server state into a large client-side global store.

Example architecture:

    React component
        |
        v
    TanStack Query
        |
        v
    REST API
        |
        v
    service/domain layer
        |
        v
    Prisma
        |
        v
    PostgreSQL

---

# 22. REST API Architecture

Keep REST APIs using Next.js route handlers.

Recommended structure:

    /api/auth/...

    /api/family/...
    /api/family-members/...

    /api/calendar/events
    /api/calendar/events/[id]

    /api/todos
    /api/todos/[id]

    /api/chores/definitions
    /api/chores/definitions/[id]
    /api/chores/occurrences
    /api/chores/occurrences/[id]

    /api/routines/definitions
    /api/routines/definitions/[id]
    /api/routines/occurrences
    /api/routines/occurrences/[id]

    /api/shopping/items
    /api/shopping/items/[id]

Use consistent HTTP semantics.

Examples:

    GET
    POST
    PATCH
    DELETE

For completion operations, either use explicit mutation endpoints or PATCH status consistently.

---

# 23. Service/Domain Layer

Do not put significant business logic directly inside route handlers.

Use:

    API route
       |
       v
    authentication
       |
       v
    authorisation
       |
       v
    domain/service function
       |
       v
    Prisma
       |
       v
    PostgreSQL

Example:

    POST /api/chores/occurrences/:id/complete

should ultimately call something like:

    completeChoreOccurrence(...)

That service should:

1. Verify the occurrence exists.
2. Determine the family.
3. Verify the current user can complete it.
4. Update the occurrence transactionally.
5. Publish/invalidate the appropriate realtime state.

---

# 24. Validation

Use Zod for API input validation.

Every mutation endpoint should validate:

- request body
- path parameters where appropriate
- query parameters where appropriate

Never trust client-provided:

- familyId
- userId
- familyMemberId
- permissions
- ownership

Family membership and authorisation must be resolved server-side.

---

# 25. Database Design Rules

Use PostgreSQL constraints wherever useful.

Use foreign keys.

Use indexes for common access patterns.

Likely important indexes include:

- FamilyMembership.userId
- FamilyMembership.familyId
- FamilyMember.familyId
- CalendarEvent.familyId + date/time
- EventParticipant.eventId
- EventParticipant.familyMemberId
- Todo.familyId + assignedToFamilyMemberId
- Chore.familyId
- ChoreSchedule.choreId
- ChoreOccurrence.familyId + date
- ChoreOccurrence.familyMemberId + date
- Routine.familyId
- RoutineSchedule.routineId
- RoutineOccurrence.familyId + date
- ShoppingItem.shoppingListId

Use unique constraints to prevent duplicate membership/occurrence data where appropriate.

Use database transactions for multi-table operations.

---

# 26. Dates and Timezones

The application is intended for family use in the UK initially.

Use a clear timezone strategy.

Do not scatter `new Date()` conversions through the application.

Calendar events must distinguish:

- date
- time
- timezone
- all-day

Recurring chores/routines are particularly sensitive to local calendar dates.

The family should have a configured timezone, defaulting to the appropriate UK timezone.

All occurrence generation should use the family's local calendar date.

Avoid UTC/date bugs such as an occurrence appearing on the wrong day around midnight.

---

# 27. Security

Minimum requirements:

- secure password handling via Better Auth
- secure sessions
- server-side authorisation
- family data isolation
- input validation
- rate limiting on authentication/invitation endpoints
- no client-controlled family access
- no sensitive data in logs
- secure environment variables
- safe error messages
- database constraints
- protection against IDOR/insecure direct object references

Critical rule:

A user from Family A must never be able to access Family B's data by changing an ID in an API request.

Every family-scoped query must enforce family membership.

---

# 28. UI Design

The UI should be inspired by Skylight's strengths without copying proprietary assets.

Desired characteristics:

- clean
- family-friendly
- visual
- uncluttered
- large readable controls
- clear colour coding
- profile/avatar indicators
- touch-friendly
- obvious completion states

Family-member colours should be consistent throughout:

- calendar
- TODOs
- chores
- routines
- dashboard

Use shadcn/ui for common primitives where it accelerates development.

---

# 29. Future Features — Architect For, Do Not Build

The architecture should leave room for:

## Calendar integrations

- Google Calendar
- Apple Calendar
- Outlook

These can be standalone integrations.

Do not implement now.

## Notifications

Currently NOT planned.

Do not build notification infrastructure merely because it could be useful.

Future possibility:

- push
- browser
- email
- reminders

But don't design the core system around notifications.

## Child accounts

Future:

- simplified account
- PIN
- restricted permissions

The current FamilyMember model must make this possible.

## Rewards

Future:

- stars
- rewards
- redemption
- parent approval

## Meal Planning

Future placeholder.

A future Meal Planning feature is desirable, but no implementation is required now.

A disabled dashboard tile may be used if it improves the UX.

## Mobile app

Potential future native/mobile supporting application.

The REST/domain architecture should allow this without modification to core business logic.

---

# 30. Deliberately Out of Scope

Do not implement:

- messaging
- event invitations
- attachments
- complex task management
- notifications
- Google/Apple/Outlook integration
- rewards engine
- child authentication
- advanced recurrence exceptions
- multiple-family membership
- external guests
- AI features
- meal planning implementation
- sophisticated missed-chore reporting
- chore rotation
- approval workflows

Do not build infrastructure merely because a future feature might need it.

---

# 31. Development Phases

## Phase 0 — Audit

Do not change application behaviour.

Inspect:

- repository
- Prisma schema
- APIs
- NextAuth
- family/member implementation
- TODO implementation
- components
- styles
- dependencies
- environment
- Vercel configuration
- tests

Create:

    docs/ARCHITECTURE_AUDIT.md

Document:

- current architecture
- current database
- current auth
- current APIs
- current TODO behaviour
- technical debt
- proposed target architecture
- migration risks

---

# 32. Phase 1 — Foundation

Implement:

- project/domain structure
- validation conventions
- API error handling
- logging
- authentication abstraction
- authorisation abstraction
- TanStack Query
- Zod
- shadcn/ui where appropriate
- testing foundation

Do not yet build all new features.

Ensure the application still works.

---

# 33. Phase 2 — Better Auth

Implement:

- Better Auth
- Prisma integration
- email/password
- registration
- login
- logout
- sessions
- family creation
- adult membership
- invitation codes
- join family
- application authorisation

Migrate existing users/data safely.

Remove NextAuth only after Better Auth has been proven.

Acceptance test:

    Adult A creates Family.

    Adult B joins using invitation code.

    Both see the same family.

    Both can access family data.

    An unauthorised user cannot access it.

    Child FamilyMember exists without an account.

---

# 34. Phase 3 — Family Management

Build:

    Family Settings

    Family Members:
        Mum
        Dad
        Child 1
        Child 2

Adults can:

- add child
- edit child
- remove/deactivate child
- edit name
- select avatar
- select colour
- manage adult membership

All downstream domains use FamilyMember.

---

# 35. Phase 4 — TODO Migration

Preserve the existing TODO functionality.

Improve it with:

- new FamilyMember architecture
- priority
- optimistic completion
- realtime synchronisation
- better UI

Do not unnecessarily add due dates/categories/subtasks.

Acceptance:

    Add TODO on laptop
        ->
    appears on phone/tablet

    Complete on phone
        ->
    wall display updates

---

# 36. Phase 5 — Calendar

Implement in this order:

1. Database model
2. API/service layer
3. Create event
4. Edit event
5. Delete event
6. Day view
7. Multi-day view
8. Week view
9. Participants
10. Colour visualisation
11. Event details
12. Location
13. Notes
14. Recurrence
15. Realtime

Acceptance:

A user can create:

    Football
    Friday
    18:00-19:00

Participants:

    Jack
    Mum

Location:

    Leeds United Academy

Notes:

    Take football boots
    Mum taking

The event is visible in all relevant views and on other connected devices.

---

# 37. Phase 6 — Chores

Implement:

1. Chore definition
2. Schedule
3. Daily occurrence generation
4. Daily list
5. Complete
6. Skip
7. Edit
8. Delete/deactivate
9. Realtime

Acceptance:

    Empty dishwasher
    Monday-Friday
    Jack

produces a daily occurrence only on applicable days.

Completing Friday does not alter Monday's schedule.

Skipping Friday does not remove Friday from future weeks.

Repeated occurrence generation does not create duplicates.

---

# 38. Phase 7 — Routines

Implement:

1. Routine definition
2. Family member assignment
3. Routine periods
4. Schedule by day
5. Routine items
6. Daily occurrence
7. Completion
8. Holiday mode
9. Realtime

Example:

    Jack
    Morning

    ☐ Get dressed
    ☐ Breakfast
    ☐ Brush teeth
    ☐ Pack school bag

Different days may have different routines.

---

# 39. Phase 8 — Shopping

Implement:

- shared grocery list
- add
- check
- uncheck
- delete
- realtime

Keep it deliberately simple.

---

# 40. Phase 9 — Family Dashboard

Combine:

- calendar
- TODOs
- chores
- routines
- shopping

The dashboard should answer:

    What is happening today?

    What does each person need to do?

    What remains incomplete?

The exact layout can evolve during implementation.

---

# 41. Phase 10 — Wall Display

Optimise for:

- landscape
- large text
- touch
- distance readability
- family overview
- realtime
- low navigation complexity
- persistent dashboard

Implement wall mode as a deliberate UI mode.

---

# 42. Phase 11 — Future Placeholders

Optionally add disabled dashboard tiles:

    ⭐ Rewards
    🍽 Meal Planning

These are visual placeholders only.

Do not build their backend functionality.

---

# 42A. Phase 12 — Special Occasions

Implement:

1. `SpecialOccasion` model (title, type, one full date, `isSomber` flag) — no
   `FamilyMember` relation, no schedule/occurrence tables
2. Computed-on-read next-occurrence/days-until/years-since (`lib/specialOccasions.ts`),
   not generated or persisted rows
3. A dedicated `/occasions` page — year overview, sorted soonest-first, add/edit/delete
4. Family Dashboard digest card — occasions within the next 7 days
5. Wall Display tile — same digest, tap to open the full list, joins the existing
   focus-view/idle-return pattern
6. Realtime (poll) — same seam as every other domain

---

# 42B. Phase 13 — Photo Screensaver

Implement:

1. `PhotoAlbum`/`Photo` models, plus `screensaverEnabled`/`screensaverAlbumId`/
   `screensaverIntervalSeconds`/`screensaverIdleSeconds` on `FamilyGroup`
   (`screensaverAlbumId` nullable, `onDelete: SetNull`, mirroring `FamilyMember.linkedUserId`)
2. `lib/photos.ts` — album CRUD, photo add/delete (calling Vercel Blob's `del()` alongside
   the DB row), and read/update for the screensaver settings, mirroring
   `lib/specialOccasions.ts`'s shape as the newest/simplest precedent
3. Upload flow: client calls Vercel Blob's `upload()` directly against a token-only
   `app/api/photos/upload/route.ts` (`onBeforeGenerateToken` checks `requireSession()` +
   family membership; no `onUploadCompleted` webhook, since that path doesn't fire on
   localhost) — once the client-side upload resolves, the client POSTs the returned blob
   URL/pathname to a normal REST endpoint to create the `Photo` row, the same
   mutate-then-refetch shape every other domain already uses
4. `app/api/photos/albums/route.ts` + `[id]/route.ts`, extend `app/api/family-group/route.ts`
   with the new screensaver settings fields (same PATCH endpoint `holidayMode` already uses)
5. `components/PhotoScreensaver.tsx` — full-screen image cycler, `setInterval` on the
   configured interval, any touch/key dismisses (same idiom as `lib/useIdleReturn.ts`)
6. A generalized idle-trigger hook (`lib/useIdleReturn.ts` extended or a sibling
   `lib/useIdleTrigger.ts`) so `WallDisplay` can run two independent idle timers: the existing
   30s one (focus view → overview) and a new configurable one (overview → screensaver)
7. `/photos` page — album management, upload/delete, screensaver settings form
8. A "Photos" tile on `FamilyDashboard` and `WallDisplay` that opens
   `PhotoScreensaver` on demand, independent of the idle timer

---

# 43. Testing Strategy

Use a mixture of:

## Unit tests

For:

- recurrence calculations
- chore schedule evaluation
- routine schedule evaluation
- permissions
- validation
- date/time handling

## Integration tests

For:

- API endpoints
- family isolation
- authentication
- authorisation
- database operations
- occurrence generation

## End-to-end tests

At minimum:

### Authentication

    register
    login
    logout

### Family

    create family
    invite adult
    join family
    create child

### TODO

    create
    complete
    delete

### Calendar

    create
    edit
    delete
    participant selection

### Chores

    schedule
    generate
    complete
    skip

### Routines

    schedule
    complete

### Shopping

    add
    complete
    remove

Test that users cannot access another family's data.

---

# 44. API Acceptance Rules

Every endpoint must:

1. Authenticate where required.
2. Resolve current user.
3. Resolve current family.
4. Validate input.
5. Check permission.
6. Perform domain operation.
7. Return consistent response/error shape.
8. Trigger appropriate realtime update if data changed.

Never trust:

    familyId supplied by client

without verifying membership.

---

# 45. Error Handling

Create consistent API error responses.

Distinguish:

- 400 validation error
- 401 unauthenticated
- 403 forbidden
- 404 not found
- 409 conflict
- 429 rate limited
- 500 unexpected error

Do not expose database internals or stack traces to users.

---

# 46. Optimistic UI

Use optimistic updates where the action is simple and reversible.

Good candidates:

- checking TODO
- completing chore
- skipping chore
- completing routine item
- checking shopping item

If the server rejects the operation:

- roll back UI
- display useful error
- invalidate affected query

---

# 47. Realtime Cache Strategy

The preferred pattern is:

    User mutation
        |
        v
    Server mutation
        |
        v
    Database
        |
        v
    Domain event
        |
        v
    Realtime subscribers
        |
        v
    TanStack Query invalidation/update
        |
        v
    UI refreshes

Avoid sending entire database objects unnecessarily.

Domain event examples:

    TODO_CREATED
    TODO_UPDATED
    TODO_COMPLETED

    CALENDAR_EVENT_CREATED
    CALENDAR_EVENT_UPDATED
    CALENDAR_EVENT_DELETED

    CHORE_COMPLETED
    CHORE_SKIPPED

    ROUTINE_ITEM_COMPLETED

    SHOPPING_ITEM_ADDED
    SHOPPING_ITEM_COMPLETED

All events must be scoped to a Family.

---

# 48. Documentation

Maintain these repository documents:

    docs/
        SPEC.md
        ARCHITECTURE_AUDIT.md
        ARCHITECTURE.md
        DATABASE.md
        API.md
        AUTH.md
        ROADMAP.md

`SPEC.md` is the product requirements baseline.

`ARCHITECTURE.md` describes implementation architecture.

`DATABASE.md` describes Prisma/domain relationships.

`API.md` describes REST APIs.

`AUTH.md` describes Better Auth and application authorisation.

`ROADMAP.md` tracks implementation phases.

Update documentation when architectural decisions materially change.

---

# 49. Coding-Agent Rules

The coding agent must follow these rules.

## Rule 1 — Inspect before changing

Before implementing a phase, inspect the existing code relevant to that phase.

Do not assume existing code matches this specification.

## Rule 2 — Do not rewrite unnecessarily

Preserve working functionality.

Prefer incremental migration.

## Rule 3 — Database first for domain changes

For a new domain:

1. Design model
2. Review relationships
3. Add migration
4. Implement service
5. Implement API
6. Implement UI

## Rule 4 — Server owns authority

The client does not determine:

- family membership
- permissions
- ownership
- roles

## Rule 5 — Avoid duplication

Do not create multiple competing abstractions for:

- users
- family members
- permissions
- API fetching
- date handling
- error handling

## Rule 6 — Small changes

Implement one coherent feature/task at a time.

After each significant change:

- run typecheck
- run lint
- run tests
- run build where appropriate

## Rule 7 — Do not over-engineer

Do not implement future features early.

Architecture should accommodate future requirements without building them.

## Rule 8 — Preserve data

Never perform destructive migrations without explicit justification.

Existing TODO/user/family data must be preserved.

## Rule 9 — Explain architectural deviations

If implementation requires a deviation from this specification, document:

- what changed
- why
- alternatives considered
- impact

## Rule 10 — Acceptance criteria

Every implementation task must end with explicit acceptance criteria and tests.

---

# 50. First Coding-Agent Task

The first task is NOT to build Calendar, Chores or Routines.

Perform a complete repository audit.

Create:

    docs/ARCHITECTURE_AUDIT.md

Inspect:

- package.json
- Next.js configuration
- Prisma schema
- migrations
- existing database access
- NextAuth configuration
- auth routes
- family routes
- TODO routes
- React components
- layouts
- styling
- environment variables
- Vercel configuration
- tests
- scripts
- dependencies

Document:

1. Current architecture
2. Current database schema
3. Current auth
4. Current family model
5. Current TODO model
6. Current API
7. Current frontend structure
8. Technical debt
9. Security concerns
10. Proposed migration path
11. Files likely to change
12. Risks
13. Any contradictions between the current implementation and this specification

DO NOT implement the new features in this first task.

DO NOT replace NextAuth in this first task.

DO NOT redesign the existing TODO feature in this first task.

The purpose of the first task is to create a reliable baseline from which the remaining phases can be implemented safely.

---

# 51. Definition of Done

The overall V1 is complete when:

- adults can authenticate securely
- adults can belong to a household
- adults can invite another adult using a household code
- children can exist as FamilyMembers without accounts
- family permissions are enforced server-side
- family members have colours/avatars
- TODO lists work per family member
- TODO priority works
- shared calendar works
- calendar supports day/multi-day/week views
- calendar supports participants
- calendar supports recurring events
- calendar supports location and notes
- recurring chores work
- chores generate daily occurrences
- chores can be completed
- chores can be skipped
- routines work per family member
- routines vary by day
- routines can be completed
- holiday mode can suppress/alter routine requirements
- shared shopping list works
- realtime synchronisation works across devices
- responsive UI works on desktop/tablet/mobile
- wall display mode works
- family data is isolated securely
- automated tests cover core business logic
- the application deploys successfully to Vercel
- existing TODO data has been migrated safely

---

# 52. Product Direction After V1

Once V1 is stable, potential next development areas are:

1. Rewards/stars
2. Meal planning
3. Child PIN/account
4. Calendar integrations
5. Calendar reminders
6. Advanced recurrence
7. Native/mobile supporting app
8. More sophisticated family dashboard
9. Historical completion/progress
10. Additional household utilities

Do not begin these until the V1 core workflow is stable.

---

# 53. Core Architectural Summary

The most important design decisions in this specification are:

    Family
       |
       +-- FamilyMember
       |      |
       |      +-- optional User
       |
       +-- Calendar
       |
       +-- TODO
       |
       +-- Chore
       |      |
       |      +-- Schedule
       |      +-- Occurrence
       |
       +-- Routine
       |      |
       |      +-- Schedule
       |      +-- Items
       |      +-- Occurrence
       |
       +-- Shopping

and:

    Authenticated User
            |
            v
    Family Membership
            |
            v
    Authorisation
            |
            v
    Domain Service
            |
            v
    Prisma
            |
            v
    PostgreSQL

and for recurring features:

    Definition
        +
    Schedule
        |
        v
    Occurrence
        |
        v
    Completion/Skip

Build around these concepts and the application should be able to grow from the current TODO prototype into a robust family-management platform without requiring another fundamental rewrite.
