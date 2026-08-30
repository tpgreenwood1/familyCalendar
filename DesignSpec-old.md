# Family Calendar — Architecture & Developer Handoff

## Overview

A wall-mounted tablet web app with two modes:

- **Calendar mode** — the default active state. Displays a family calendar with events.
- **Gallery mode** — activates automatically after a configurable period of inactivity. Displays a rotating photo gallery. Any touch or interaction returns to calendar mode.

The app is a Next.js 14 web app (App Router, TypeScript, Tailwind CSS), deployed on Vercel, with a Neon Postgres database accessed via Prisma. Photos are sourced from Google Photos but synced to Cloudflare R2 for unattended serving.

The tablet runs Chrome in kiosk mode (or as a PWA installed to the home screen on Android), keeping the app permanently visible on the wall.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│              Tablet client (browser / kiosk)        │
│                                                     │
│   ┌─────────────────┐       ┌─────────────────┐    │
│   │  Calendar mode  │◄─────►│  Gallery mode   │    │
│   └─────────────────┘       └─────────────────┘    │
│                  ▲       ▲                          │
│                  └───┬───┘                          │
│             ┌────────────────┐                      │
│             │   Idle timer   │                      │
│             │ (JS, client)   │                      │
│             └────────────────┘                      │
└──────────────────────┬──────────────────────────────┘
                       │ API calls (fetch)
┌──────────────────────▼──────────────────────────────┐
│              Vercel — Next.js 14 app                │
│                                                     │
│   ┌─────────────────────────────────────────────┐  │
│   │         App Router + API routes             │  │
│   │   /api/events  /api/photos  /api/config     │  │
│   └──────────┬──────────────────────┬───────────┘  │
│              │                      │               │
│   ┌──────────▼──────┐   ┌───────────▼───────────┐  │
│   │   Vercel Cron   │   │       NextAuth        │  │
│   │  Google Photos  │   │   (admin access only) │  │
│   │   → R2 sync     │   └───────────────────────┘  │
│   └──────────┬──────┘                               │
└──────────────┼──────────────────────────────────────┘
               │
    ┌──────────┴────────────────────────────────┐
    │                                           │
┌───▼──────────────┐              ┌─────────────▼──────┐
│  Neon Postgres   │              │   Cloudflare R2    │
│                  │              │                    │
│  events          │              │  photo originals   │
│  photos          │              │  thumbnails        │
│  app_config      │              │  (generated on     │
│  sync_log        │              │   sync)            │
└──────────────────┘              └────────────────────┘
                                           ▲
                                  ┌────────┴───────┐
                                  │ Google Photos  │
                                  │ (source only)  │
                                  └────────────────┘
```

---

## Tech Stack

| Layer         | Choice                  | Notes                                              |
| ------------- | ----------------------- | -------------------------------------------------- |
| Framework     | Next.js 14 (App Router) | TypeScript throughout                              |
| Styling       | Tailwind CSS            | Dark theme as default                              |
| Database      | Neon Postgres           | Serverless-compatible                              |
| ORM           | Prisma                  | Singleton client pattern in `lib/prisma.ts`        |
| Deployment    | Vercel                  | Build command includes `prisma generate`           |
| Auth          | NextAuth.js             | Admin-only; the tablet itself runs unauthenticated |
| Photo storage | Cloudflare R2           | Synced from Google Photos via cron                 |
| Photo source  | Google Photos           | One-way sync only; R2 is the serving layer         |

---

## Repository Structure

```
family-calendar/
├── app/
│   ├── api/
│   │   ├── config/route.ts       # App config (e.g. idle timeout, app label)
│   │   ├── events/route.ts       # Calendar CRUD
│   │   └── photos/route.ts       # Photo metadata list
│   ├── layout.tsx
│   └── page.tsx                  # Root — renders calendar or gallery based on state
├── components/
│   ├── CalendarView.tsx
│   ├── GalleryView.tsx
│   └── IdleTimer.tsx             # Client component, manages mode switching
├── lib/
│   ├── prisma.ts                 # Prisma singleton
│   └── r2.ts                    # Cloudflare R2 client (AWS SDK v3)
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── .env.example
├── vercel.json
└── package.json
```

---

## Database Schema

### `AppConfig`

Stores app-wide key/value configuration.

| Column | Type   | Notes                                            |
| ------ | ------ | ------------------------------------------------ |
| id     | Int    | PK, autoincrement                                |
| key    | String | Unique. e.g. `app_label`, `idle_timeout_seconds` |
| value  | String | String-encoded values                            |

### `Event`

Calendar events.

| Column      | Type     | Notes         |
| ----------- | -------- | ------------- |
| id          | String   | UUID, PK      |
| title       | String   |               |
| description | String?  | Optional      |
| startAt     | DateTime |               |
| endAt       | DateTime |               |
| allDay      | Boolean  | Default false |
| createdAt   | DateTime | Auto          |
| updatedAt   | DateTime | Auto          |

### `Photo`

Metadata for photos synced to R2.

| Column     | Type      | Notes                                               |
| ---------- | --------- | --------------------------------------------------- |
| id         | String    | UUID, PK                                            |
| googleId   | String    | Unique. Google Photos media item ID, used for dedup |
| r2Key      | String    | Path in R2 bucket (original)                        |
| r2ThumbKey | String    | Path in R2 bucket (thumbnail)                       |
| takenAt    | DateTime? | From Google Photos metadata                         |
| width      | Int       |                                                     |
| height     | Int       |                                                     |
| syncedAt   | DateTime  | When this was pulled into R2                        |

### `SyncLog`

Records of each Google Photos → R2 sync run.

| Column      | Type     | Notes                            |
| ----------- | -------- | -------------------------------- |
| id          | Int      | PK, autoincrement                |
| ranAt       | DateTime |                                  |
| photosAdded | Int      |                                  |
| errors      | String?  | JSON-encoded error list if any   |
| status      | String   | `success` / `partial` / `failed` |

---

## Mode Switching

Mode switching is handled entirely on the client. The root page renders a client component (`IdleTimer`) that:

1. Listens for `mousemove`, `touchstart`, and `keydown` events on the window.
2. Resets a timer on each event.
3. When the timer expires (configurable via `AppConfig`, default 3 minutes), transitions to gallery mode.
4. Any user interaction while in gallery mode immediately returns to calendar mode.
5. The current mode is held in React state — no server involvement, no URL change.

The idle timeout value is fetched from the API on load and stored in component state so it can be changed from the database without a code deploy.

---

## Photo Sync — Google Photos to R2

Google Photos OAuth tokens expire and require user interaction to renew, making direct serving from Google Photos unsuitable for an unattended wall display. The solution is a one-way sync into R2.

**How it works:**

1. A Vercel cron job runs on a schedule (e.g. nightly at 2am).
2. It calls the Google Photos API using a stored refresh token.
3. For each media item not already in the `Photo` table (matched on `googleId`), it:
   - Downloads the image from Google Photos.
   - Generates a thumbnail using `sharp`.
   - Uploads both to Cloudflare R2.
   - Writes a row to the `Photo` table.
   - Logs the run to `SyncLog`.
4. The gallery reads photo metadata from the `Photo` table and serves images directly from R2 public URLs.

**Environment variables required for sync:**

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=        # Long-lived refresh token, obtained via OAuth flow once
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=               # Public base URL for the R2 bucket
```

**Obtaining the Google refresh token:**

Run a one-off local OAuth flow (e.g. using the Google OAuth Playground or a small script) with the `https://www.googleapis.com/auth/photoslibrary.readonly` scope. Store the resulting refresh token in Vercel environment variables. This only needs to be done once.

---

## Vercel Configuration

### `vercel.json`

```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install",
  "crons": [
    {
      "path": "/api/sync/photos",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Environment variables to configure in Vercel dashboard

```
DATABASE_URL=              # Neon connection string (use pooled URL for app, direct URL for migrations)
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

> **Neon note:** Use the pooled connection string (`?pgbouncer=true&connection_limit=1`) for the running app. Use the direct (non-pooled) connection string for Prisma migrations — set this as `DIRECT_URL` in `schema.prisma` if running migrations from Vercel.

---

## Tablet Setup

The app is a standard web app — no native build required.

**Option A — Chrome kiosk mode (Linux / Raspberry Pi / ChromeOS):**

```bash
google-chrome --kiosk --app=https://your-app.vercel.app --noerrdialogs --disable-infobars
```

**Option B — Android tablet (PWA):**

- Add a `manifest.json` with `"display": "standalone"` and appropriate icons.
- Open the app in Chrome, tap "Add to Home Screen".
- Launch from the home screen — runs fullscreen with no browser chrome.
- Use a kiosk launcher app (e.g. Fully Kiosk Browser) for auto-start on boot and screen wake management.

---

## Next Steps for the Developer

These are ordered by dependency — each step builds on the previous.

### 1. Database migrations and seed

- Add the full schema to `prisma/schema.prisma` (Event, Photo, SyncLog models as above).
- Run `npx prisma migrate dev` locally against the Neon dev branch.
- Expand the seed file with a few sample events.

### 2. Calendar view

- Build `CalendarView.tsx` — start with a simple month grid.
- Create `GET /api/events` returning events for a given month (`?year=&month=` query params).
- Create `POST /api/events` and `DELETE /api/events/[id]` for basic CRUD.
- Consider whether to use a calendar library (e.g. `react-big-calendar` or `@fullcalendar/react`) or build a simple grid from scratch — given the tablet display context, a custom grid gives more control over the layout.

### 3. Idle timer and mode switching

- Build `IdleTimer.tsx` as a client component wrapping the page.
- Fetch `idle_timeout_seconds` from `/api/config` on mount.
- Implement the event listener logic and mode state as described above.
- Add a smooth CSS transition between modes (fade works well on a wall display).

### 4. Gallery view — placeholder

- Build `GalleryView.tsx` with a simple full-screen image display.
- For now, drive it from a hardcoded array of placeholder images (Unsplash URLs are fine).
- Implement a crossfade slideshow — 10–15 seconds per photo is a good default.

### 5. Google Photos sync

- Implement `GET /api/sync/photos` — this is the cron endpoint.
- Protect it with a `CRON_SECRET` header check (Vercel sets this automatically for cron invocations).
- Use the Google Photos REST API (`https://photoslibrary.googleapis.com/v1/mediaItems`) with the refresh token to list and download photos.
- Use `sharp` for thumbnail generation (resize to 1920px wide, quality 80).
- Use the AWS SDK v3 (`@aws-sdk/client-s3`) to upload to R2 — R2 is S3-compatible.
- Write metadata to the `Photo` table and log the run to `SyncLog`.

### 6. Wire gallery to R2

- Update `GET /api/photos` to return rows from the `Photo` table (r2ThumbKey → full public URL).
- Update `GalleryView.tsx` to fetch from this endpoint instead of placeholders.
- Add a shuffle or date-ordered display option (configurable via `AppConfig`).

### 7. Admin / event management

- Wrap admin routes with NextAuth — the tablet display itself is unauthenticated.
- Build a simple `/admin` route for adding and editing calendar events, accessible from another device on the same account.
- This doesn't need to be a full UI immediately — a simple form is enough.

### 8. PWA and tablet hardening

- Add `manifest.json` and icons for PWA install.
- Add a service worker for basic offline resilience (show last cached state if network drops).
- Test the idle timer behaviour with the actual tablet touch screen — tune the timeout.
- Set the tablet screen to never sleep (controlled at OS/browser level, not in the app).

---

## Key Decisions to Revisit

- **Google Calendar integration** — instead of building a custom event store, the calendar could read from Google Calendar API directly. This avoids double-entry if the family already uses it. Adds OAuth complexity but removes the need for the Event table and admin UI. Worth evaluating before building the CRUD layer.

- **Gallery curation** — the current design syncs everything from Google Photos. Consider whether to sync a specific album only (a curated "Wall Display" album), which is cleaner and avoids syncing photos you don't want on the wall. This is a one-line change to the API call.

- **Real-time event updates** — if multiple family members add events, they won't appear on the wall until the next page load. A simple polling approach (refetch events every 5 minutes) is probably sufficient; full WebSocket/SSE is overkill for this use case.
