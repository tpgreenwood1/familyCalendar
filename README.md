# Family Calendar

Wall-mounted tablet app built with Next.js 14, Prisma, and Neon Postgres.

## Stack

- **Next.js 14** — App Router, TypeScript, Tailwind CSS
- **Prisma** — ORM, migrations, seeding
- **Neon** — serverless Postgres (production)
- **Vercel** — hosting

---

## Running locally

### Prerequisites

- Node.js 18+
- Postgres running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/family_calendar"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/family_calendar"
```

Both vars point to the same local instance. See the Neon section below for how they differ in production.

### 3. Create the database

```sql
CREATE DATABASE family_calendar;
```

### 4. Apply migrations

```bash
npx prisma migrate deploy
```

### 5. Seed data

Either run the seed script:

```bash
npx prisma db seed
```

Or insert directly:

```sql
INSERT INTO "AppConfig" (key, value)
VALUES ('app_label', 'Family Calendar')
ON CONFLICT (key) DO NOTHING;
```

### 6. Start the dev server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## Vercel deployment

### Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (hostname contains `-pooler`) |
| `DIRECT_URL` | Neon **direct** connection string (same but without `-pooler`) |

Neon provides both strings in its dashboard under **Connection Details**.

### How the build works

`vercel.json` sets the build command to:

```
npx prisma generate && next build
```

This regenerates the Prisma client from `schema.prisma` on every Vercel build before Next.js compiles, so the client always matches the current schema. No manual step needed after a schema change — just redeploy.

---

## Database changes

### Adding or changing a model

1. Edit `prisma/schema.prisma`
2. Create a migration locally:
   ```bash
   npx prisma migrate dev --name describe_your_change
   ```
   This generates a new SQL file under `prisma/migrations/`.
3. Apply it to Neon using the **direct** connection:
   ```bash
   npx prisma migrate deploy
   ```
   Prisma reads `DIRECT_URL` for this — the direct connection bypasses PgBouncer, which blocks the session-level commands the migration engine needs.
4. Commit the new migration file and redeploy to Vercel.

### Why two connection strings?

| | `DATABASE_URL` (pooled) | `DIRECT_URL` (direct) |
|---|---|---|
| Used by | App at runtime | Prisma CLI (`migrate`, `seed`) |
| Goes through | PgBouncer (Neon pooler) | Direct to Postgres |
| Why | Efficient connection reuse under load | Migrations need session-level commands PgBouncer blocks |

The app itself always queries through the pooled URL. The direct URL is only ever used by CLI commands run from your machine.
