# FactNews Bangladesh (ফ্যাক্টনিউজ বাংলাদেশ) — Bilingual BD Verified News + Fact-Checker

> Note: Manage PAT tokens securely offline using `node web/scripts/manage_pat.mjs create "Daily Scraper"`. Public UI exposes zero admin/PAT routes.

## Architecture Overview
- **Frontend & ISR (`web/`)**: Next.js 15 + React 19 + Tailwind CSS v4 with **Incremental Static Regeneration (ISR)** (`revalidate = 120` on home/fact-check, `300` on article pages, plus on-demand `revalidatePath()` on PAT push). Strictly **read-only** (zero likes, zero comments, share-only bar).
- **Supabase Text-Only Backend (`supabase/migrations/`)**:
  - `0001_schema.sql`: `sources`, `articles`, `article_sources`, `fact_checks`, `pat_tokens` (SHA-256 hashed), `ingest_logs`.
  - `0002_rls_and_security.sql`: Strict Row-Level Security — `anon` has **SELECT only** on published content; zero anonymous writes.
  - `0003_seed_sources.sql`: Pre-seeds 30 Bangladeshi national, regional & fact-checking outlets.
- **Signed Image CDN Wrapper (`cdn-worker/` + `/api/cdn/image`)**:
  - Wraps external news images behind HMAC-SHA256 tokens (`/api/cdn/image?t=...` or `https://cdn.yourdomain.com/i/<token>.webp`) with `Referrer-Policy: no-referrer`, SSRF checks, aggressive Cloudflare edge caching, and clean SVG fallback.
- **BD Multi-Source Scraper & Cross-Verifier (`scraper/bd_news_scraper.py`)**:
  - Tests 30 Bangladeshi outlets (Prothom Alo, The Daily Star, bdnews24, Samakal, Ittefaq, TBS, Dhaka Tribune, Ajker Patrika, Dainik Azadi, Rumor Scanner, Dismislab, etc.), clusters matching events across outlets, scores confidence, and pushes via PAT (`Authorization: Bearer news_pat_...`).

## Deploying to Cloudflare Pages / Workers (Unlimited Bandwidth + Static ISR)
1. Deploy Supabase SQL migrations (`supabase/migrations/0001..0003.sql`) using Supabase SQL Editor or `.\supabase\push_migrations.ps1`.
2. Deploy the Image CDN Worker (`cd cdn-worker && npx wrangler deploy && npx wrangler secret put CDN_SIGNING_SECRET`).
3. Deploy Next.js with `@opennextjs/cloudflare` (for full ISR + `revalidatePath`) or Cloudflare Pages, setting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CDN_SIGNING_SECRET`, and `NEXT_PUBLIC_CDN_BASE_URL`.
