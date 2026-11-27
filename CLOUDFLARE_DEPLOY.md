# Cloudflare + Supabase Deployment Guide — FactNews Bangladesh (`factnewsbangladesh.bond`)

## 0. Domain & Hosting Clarification (Pages vs Workers + Static Assets)

Both Cloudflare hosting modes give you **Unlimited Free Bandwidth** on Cloudflare's global CDN:

| Mode | Bandwidth | Daily Free Limit | When Breaking News Updates Appear | Current Repo Status |
|---|---|---|---|---|
| **A. Cloudflare Workers + Assets (OpenNext)** | Unlimited | 100,000 Worker reqs/day (static `.open-next/assets` served directly at Edge) | **Instant ISR** via `POST /api/v1/ingest` (`revalidatePath`) — zero rebuild delay | **Pre-configured** (`web/wrangler.jsonc`, `web/open-next.config.mjs`) |
| **B. Pure Cloudflare Pages (Static Export)** | Unlimited | Unlimited static HTML page views (Functions limit: 100k reqs/day only on API/CDN) | Rebuilds via Cloudflare Pages **Deploy Hook** (~45s) on each push | Ask assistant `"Pages Static Export করো"` to switch `web/` to `output: 'export'` + `functions/` |

> **Recommendation:** If you expect high traffic bursts on breaking news and want `0` daily request limits for readers on static pages, Pure Cloudflare Pages (**Mode B**) + Deploy Hook is ideal. If you push news every few minutes and want instant updates without rebuilding 60+ HTML files each time, **Mode A (OpenNext Workers + Static Assets)** is ready to deploy immediately.

---

## Step 1 — One-Click Supabase Setup (`supabase/FULL_SETUP_ONE_CLICK.sql`)

1. Create a free project on [Supabase](https://supabase.com).
2. Go to **SQL Editor -> New query**.
3. Open [`supabase/FULL_SETUP_ONE_CLICK.sql`](./supabase/FULL_SETUP_ONE_CLICK.sql), copy the **entire file**, paste it once, and click **Run**.
   *(Combines schema, triggers, strict read-only RLS, security revokes, and 30 Bangladeshi newspaper + fact-check sources in one idempotent run.)*
4. Copy from **Project Settings -> API**:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **anon public** key
   - **service_role** secret key *(never expose this publicly)*

---

## Step 2 — Generate Secrets & Agent PAT (Local Terminal)

```powershell
cd web
# Generate a strong 32+ char CDN secret (example using Node):
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# Generate your Agent Push PAT (`news_pat_...`):
node scripts/manage_pat.mjs create "Daily Agency Scraper"
```
> Copy the `news_pat_...` token once and save it safely — you will use it to push verified articles.

---

## Step 3 — Deploy Image CDN Worker (`cdn.factnewsbangladesh.bond`)

```powershell
cd cdn-worker
npx wrangler login
npx wrangler secret put CDN_SIGNING_SECRET   # paste your 32+ char secret from Step 2
npx wrangler deploy
```
In Cloudflare Dashboard -> **Workers & Pages -> `bd-factnews-cdn` -> Settings -> Domains & Routes -> Add -> Custom Domain**:
- Add: `cdn.factnewsbangladesh.bond` *(Cloudflare auto-configures DNS SSL if your domain nameservers are on Cloudflare).*

---

## Step 4 — Deploy Main News Website (`factnewsbangladesh.bond`)

```powershell
cd web
npm install -D @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx wrangler deploy
```

Set these **Environment Variables & Secrets** in Cloudflare Dashboard -> **Workers & Pages -> `factnews-bangladesh` -> Settings -> Variables and Secrets** *(or via `npx wrangler secret put <KEY>`)*:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://factnewsbangladesh.bond` |
| `NEXT_PUBLIC_CDN_BASE_URL` | `https://cdn.factnewsbangladesh.bond` *(or omit to use built-in `/api/cdn/image`)* |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<your supabase anon public key>` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<your supabase service_role key>` |
| `CDN_SIGNING_SECRET` | `<same secret used in cdn-worker>` |
| `INGEST_PAT_SECRET` | `<your news_pat_... token from Step 2>` |
| `ADMIN_CONSOLE_SECRET` | `<random 24+ char admin secret>` |

Then bind your domain:
- **Cloudflare Dashboard -> Workers & Pages -> `factnews-bangladesh` -> Settings -> Domains & Routes -> Add -> Custom Domain**:
  - `factnewsbangladesh.bond`
  - `www.factnewsbangladesh.bond`

---

## Step 5 — Push Live News Daily via Scraper Agent

```powershell
python scraper/bd_news_scraper.py --push-url https://factnewsbangladesh.bond/api/v1/ingest --pat <YOUR_NEWS_PAT>
```

---

## Want the AI Agent to Deploy Automatically?

Instead of manually typing commands, share **only scoped, revocable** credentials (never share your main Cloudflare/Supabase login passwords):
1. **Cloudflare:** Run `npx wrangler login` once in browser **OR** create a scoped **Cloudflare API Token** (`Workers Scripts: Edit`, `Cloudflare Pages: Edit`, `Zone -> DNS: Edit` for `factnewsbangladesh.bond`).
2. **Supabase:** Share your `Project URL`, `anon` key, `service_role` key *(and optionally the Postgres URI / Access Token only if you want us to push SQL from CLI instead of clicking Run once in SQL Editor)*.
