# Sports News Platform — Starter Codebase

This is the Step 1–4 scaffold from the architecture plan: project setup, database
schema, ingestion pipeline (football-data.org), automated quality checks, and the
admin approval dashboard, plus Facebook auto-posting on approval.

## What's included

- `prisma/schema.prisma` — full data model (articles, sources, social_posts, admin_users, vertical)
- `src/lib/ingestion/` — football-data.org fetcher, dedup logic, quality checks (profanity + readability), orchestrator
- `src/lib/social/facebook.ts` — posts to your Facebook Page on article approval
- `src/lib/auth.ts` + `src/app/admin/` — login-protected approval queue (approve/reject)
- `src/app/page.tsx`, `src/app/article/[slug]/page.tsx` — public site with basic SEO (NewsArticle schema)
- `src/app/api/cron/ingest/route.ts` — the endpoint your cron job calls

## Setup steps

1. **Install dependencies** (needs internet access, run this on your own machine):
   ```
   npm install
   ```

2. **Set up your database.** Create a Postgres (or MySQL) database, then:
   ```
   cp .env.example .env
   ```
   Fill in `DATABASE_URL` and every other value in `.env`. If your host only offers
   MySQL, change `provider = "postgresql"` to `provider = "mysql"` in
   `prisma/schema.prisma`.

3. **Run the migration** to create the tables:
   ```
   npx prisma migrate dev --name init
   ```

4. **Create your first admin login:**
   ```
   npx tsx scripts/createAdmin.ts you@example.com yourpassword
   ```

5. **Get a football-data.org API key** (free): sign up at football-data.org, add it
   to `FOOTBALL_DATA_API_KEY` in `.env`.

6. **Run the site locally:**
   ```
   npm run dev
   ```
   Visit `http://localhost:3000` (empty at first — nothing's published yet) and
   `http://localhost:3000/admin/login` to log in.

7. **Run ingestion manually to test it:**
   ```
   npm run ingest
   ```
   This pulls recent matches, dedupes them, runs quality checks, and drops
   anything that passes into the review queue. Log into `/admin` and you should
   see articles waiting for approval.

8. **Approve an article** in `/admin` — it will publish to the homepage. If you've
   filled in your Facebook credentials, it will also attempt to post to your Page.

## What's not built yet (next steps from here)

- **Cricket ingestion** — same pattern as `footballData.ts`, using CricketData.org.
  Add `fetchCricketData()` and call it alongside `fetchFootballData()` in `runIngest.ts`.
- **Cron scheduling** — on your shared host, set up a cron job to call
  `GET /api/cron/ingest` with the `Authorization: Bearer <CRON_SECRET>` header,
  every 10-15 minutes.
- **X and Instagram posting** — Phase 2/3 from the roadmap, built the same way
  `facebook.ts` is: an isolated module called from `approveArticle()`.
- **Trending score** — currently defaults to 0; wire in Google Trends (`pytrends`)
  or Reddit signals per the plan, and sort the homepage by it.
- **Styling** — this is deliberately bare-bones HTML/inline styles so the logic
  is easy to read. Style the site once the pipeline works end to end.

## Deploying to shared hosting

- Confirm your host's cPanel has "Setup Node.js App" (Node 20 LTS)
- Point it at this project, run `npm install && npx prisma migrate deploy && npm run build`
- Set the startup file to Next's server entry (your host's Node.js Selector UI will
  guide you through this — it typically wants a `server.js` or similar; consult
  your host's Node.js app documentation for the exact entry point it expects)
- Set all `.env` values in the hosting panel's environment variable settings, not
  in a committed file
