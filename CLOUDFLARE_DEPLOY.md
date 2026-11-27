# Cloudflare + Supabase Deployment Guide — FactNews Bangladesh

## 1. Architecture on Cloudflare (Unlimited Bandwidth + Static Incremental / ISR)
- **Main Next.js App (`web/`):** Deploy to **Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`)** — official Cloudflare runtime for Next.js 15 App Router with **ISR (`revalidate`)**, `revalidatePath()`, and global Cloudflare Edge CDN (unlimited bandwidth). *(Note: Legacy `@cloudflare/next-on-pages` is deprecated by Cloudflare for modern Next.js 15+ apps.)*
- **Dedicated Image CDN Wrapper (`cdn-worker/`):** Deploy as a lightweight standalone Cloudflare Worker (`cdn.yourdomain.com`) so all publisher images load via signed HMAC tokens (`/i/<token>.webp`) with aggressive Cloudflare Edge caching and `Referrer-Policy: no-referrer`.
- **Supabase PostgreSQL (`supabase/`):** Stores **text-only** articles, verified source links, and SHA-256 hashed PAT tokens with strict Read-Only RLS (`anon` can only `SELECT` published articles).

---

## 2. Step-by-Step Deployment

### Step A — Supabase Database (5 mins)
1. Create a free Supabase project at https://supabase.com
2. Open **SQL Editor** and run in exact order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls_and_security.sql`
   - `supabase/migrations/0003_seed_sources.sql`
3. Copy your `Project URL`, `anon public` key, and `service_role` secret key.

### Step B — Image CDN Cloudflare Worker (`cdn-worker/`)
```powershell
cd cdn-worker
npx wrangler login
npx wrangler secret put CDN_SIGNING_SECRET   # use a 32+ char random secret
npx wrangler deploy
```
- Optionally bind a custom domain like `cdn.yourdomain.com` in Cloudflare Dashboard -> **Workers & Pages -> bd-factnews-cdn -> Settings -> Domains & Routes**.

### Step C — Main Next.js App on Cloudflare (`web/`)
```powershell
cd web
npm install -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx wrangler deploy
```
Set these **Environment Variables / Secrets** in Cloudflare Dashboard -> **Workers & Pages -> factnews-bangladesh -> Settings -> Variables and Secrets** (or `npx wrangler secret put <KEY>`):
- `NEXT_PUBLIC_SITE_URL` = `https://yourdomain.com`
- `NEXT_PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<supabase_anon_key>`
- `SUPABASE_URL` = `https://<ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `<supabase_service_role_key>`
- `CDN_SIGNING_SECRET` = `<same 32+ char secret as cdn-worker>`
- `NEXT_PUBLIC_CDN_BASE_URL` = `https://cdn.yourdomain.com` *(optional; if omitted uses built-in `/api/cdn/image`)*
- `INGEST_PAT_SECRET` = `<generate via: node scripts/manage_pat.mjs create>`
- `ADMIN_CONSOLE_SECRET` = `<strong 24+ char admin secret>`

### Step D — Automated Daily News Pushing (Your Agency Agent)
```powershell
python scraper/bd_news_scraper.py --push-url https://yourdomain.com/api/v1/ingest --pat <YOUR_INGEST_PAT>
```
Every push validates your SHA-256 PAT, upserts multi-paragraph articles + verified publisher links into Supabase, and triggers `revalidatePath()` on the edge!
