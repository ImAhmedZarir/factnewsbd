# Cloudflare Pages + Supabase Deployment Guide — FactNews Bangladesh (`factnewsbangladesh.bond`)

## 1. Architecture Designed for Maximum Scale & Unlimited Free Bandwidth

- **Main News Site (`web/`, Pure Cloudflare Pages `output: "export"` + Edge `functions/`):**
  - Every news page (`/`, `/news/[slug]`, `/about`, `/contact`, `/privacy`, `/terms`, `sitemap.xml`, `robots.txt`) compiles to **pure static HTML + JS + CSS** inside `web/out/`.
  - **Unlimited Free Bandwidth & Unlimited Reader Page Views:** Normal readers hit Cloudflare's 300+ global edge POPs directly — **0 Worker requests and 0 Supabase database calls per reader view**, handling massive traffic spikes seamlessly.
  - **Edge APIs (`web/functions/api/`):**
    - `POST /api/v1/ingest` — Validates SHA-256 Bearer PAT, signs image tokens, upserts articles + sources into Supabase, and triggers `CLOUDFLARE_DEPLOY_HOOK_URL` to rebuild fresh static HTML automatically.
    - `GET /api/cdn/image?t=...` — Verifies HMAC-SHA256 image token, strips referrer headers, and caches publisher images in Cloudflare Edge Cache (`caches.default`).
    - `GET /api/health` — Deployment status check.
- **Optional Standalone Image CDN Worker (`cdn-worker/`):**
  - Deploy to `cdn.factnewsbangladesh.bond` and enable a Cloudflare **Cache Rule ("Cache Everything")** on `cdn.factnewsbangladesh.bond/i/*` so repeat image loads serve directly from edge cache.
- **Supabase PostgreSQL (`supabase/FULL_SETUP_ONE_CLICK.sql`):**
  - Text-only database with explicit table `GRANT`s + strict Read-Only RLS (`anon` can only `SELECT` published articles).

---

## Step 1 — One-Click Supabase Setup (`supabase/FULL_SETUP_ONE_CLICK.sql`)

1. Open Supabase Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/FULL_SETUP_ONE_CLICK.sql`](./supabase/FULL_SETUP_ONE_CLICK.sql) and click **Run**.
   *(Creates schema, explicit `GRANT` privileges, triggers, Read-Only RLS policies, and 30 Bangladeshi news sources idempotently.)*
3. Copy **Project URL**, **anon public** key, and **service_role** key from **Project Settings → API**.

---

## Step 2 — Local Build & Secrets (`web/.env.local`)

Copy `web/.env.example` to `web/.env.local` (never commit `.env.local`) and fill in Supabase keys + secrets, then generate an ingestion PAT:

```powershell
cd web
node scripts/manage_pat.mjs create "Daily BD Scraper"
npm run build
```

---

## Step 3 — Deploy Pure Cloudflare Pages (`factnewsbangladesh.bond`)

```powershell
cd web
npx wrangler login
npx wrangler pages project create factnews-bangladesh --production-branch main
npx wrangler pages deploy out --project-name factnews-bangladesh
```

Add **Secrets & Env Vars** in Cloudflare Dashboard → **Workers & Pages → `factnews-bangladesh` → Settings → Variables and Secrets**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://factnewsbangladesh.bond` |
| `NEXT_PUBLIC_CDN_BASE_URL` | `https://cdn.factnewsbangladesh.bond` *(or omit to use `/api/cdn/image`)* |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<supabase anon key>` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<supabase service_role key>` |
| `CDN_SIGNING_SECRET` | `<32+ char random secret>` |
| `INGEST_PAT_SECRET` | `<your news_pat_... token>` |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | `<Cloudflare Pages -> Settings -> Builds & deployments -> Deploy hooks>` |

Then go to **Custom domains → Set up a custom domain** and bind:
- `factnewsbangladesh.bond`
- `www.factnewsbangladesh.bond`

---

## Step 4 — Optional Dedicated Image CDN (`cdn.factnewsbangladesh.bond`)

```powershell
cd cdn-worker
npx wrangler secret put CDN_SIGNING_SECRET   # exact same secret as above
npx wrangler deploy
```

Bind custom domain `cdn.factnewsbangladesh.bond` in **Workers & Pages → `bd-factnews-cdn` → Settings → Domains & Routes**.

---

## Step 5 — Push Fresh Verified News Daily

```powershell
python scraper/bd_news_scraper.py --push-url https://factnewsbangladesh.bond/api/v1/ingest --pat <YOUR_NEWS_PAT>
```
