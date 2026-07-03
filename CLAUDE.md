# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A wall-mounted tablet family calendar app: Next.js 14 (App Router, TypeScript, Tailwind), Prisma + Neon Postgres, deployed on Vercel. The tablet runs unauthenticated in kiosk mode; admin access (event editing) is intended to be gated behind NextAuth.

**Important: the repo is early scaffolding, not the finished app.** `DesignSpec.md` describes the *target* architecture — two client modes (calendar / idle-triggered photo gallery), Google Photos → Cloudflare R2 sync via Vercel cron, `Event` / `Photo` / `SyncLog` models. **Almost none of that exists yet.** Treat `DesignSpec.md` as a roadmap (see its "Next Steps for the Developer" section), not a description of current code.

What actually exists today:
- Prisma schema has **only** `AppConfig` (key/value). No `Event`, `Photo`, or `SyncLog` models.
- One API route: `app/api/config/route.ts` (GET `app_label`).
- `app/page.tsx` renders the app label with DB-error fallback. No calendar, gallery, idle timer, or components yet.
- No `components/`, no `lib/r2.ts`, no auth, no sync endpoint — despite what `DesignSpec.md` shows.

When adding features from the design spec, verify against the actual schema and files rather than assuming the spec-described code is present.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # next build (Vercel prepends `npx prisma generate`)
npm run lint         # next lint (eslint-config-next)
npx prisma db seed   # runs prisma/seed.ts via ts-node (upserts app_label)
```

Database changes:
```bash
npx prisma migrate dev --name <change>   # create + apply migration locally
npx prisma migrate deploy                # apply to Neon (uses DIRECT_URL)
npx prisma generate                      # regenerate client after schema edits
```

There is no test runner configured.

## Architecture notes that aren't obvious from a single file

- **Two connection strings, by design.** `schema.prisma` uses `url = DATABASE_URL` (pooled, PgBouncer — used by the running app) and `directUrl = DIRECT_URL` (direct — used by Prisma CLI for `migrate`/`seed`, because PgBouncer blocks the session-level commands the migration engine needs). Locally both point at the same Postgres. In production they are Neon's pooled (`-pooler` in hostname) vs. direct strings. Migrations run against the direct URL — never route them through the pooler.

- **Prisma client is a singleton** (`lib/prisma.ts`) cached on `globalThis` outside production, to avoid exhausting connections under Next.js hot-reload. Always import `prisma` from `@/lib/prisma`; don't `new PrismaClient()` elsewhere (the seed script is the one intentional exception since it runs standalone).

- **`@/*` path alias** maps to the repo root (`tsconfig.json`), so `@/lib/prisma`, `@/app/...`, etc.

- **DB failures degrade gracefully, not crash.** `app/page.tsx` catches DB errors and renders a fallback label + error string rather than throwing. Follow this pattern for the wall display — it must keep showing *something* even when the DB or network is down.

- **Vercel build regenerates the Prisma client** (`vercel.json` build command `npx prisma generate && next build`), so a schema change is picked up on redeploy with no manual step. When the design spec's cron sync is built, `crons` config goes in `vercel.json` too (currently absent).

## Environment

Local `.env` needs `DATABASE_URL` and `DIRECT_URL` (see `README.md`). The design spec lists many more vars (`GOOGLE_*`, `R2_*`, `NEXTAUTH_*`) for features not yet implemented — only add/require them when building the corresponding feature.
