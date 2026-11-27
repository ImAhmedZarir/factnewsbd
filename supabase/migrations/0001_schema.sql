-- ============================================================================
-- 0001_schema.sql
-- BD FactNews — Text-Only Read-Only News + Cross-Source Fact-Check Schema
-- Designed for Supabase PostgreSQL (Free/Pro Tier) with Image CDN Token Refs
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Newspapers & Fact-Checking Sources
create table if not exists public.sources (
  id text primary key,
  name_en text not null,
  name_bn text not null,
  domain text not null unique,
  lang text not null check (lang in ('bn', 'en')),
  tier smallint not null default 2 check (tier between 1 and 4),
  region text not null default 'national',
  rss_url text,
  sitemap_url text,
  is_active boolean not null default true,
  last_scraped_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);

-- 2. Published Verified Articles (Text-only; images served via signed CDN wrapper)
create table if not exists public.articles (
  id text primary key,
  slug text not null unique,
  lang text not null default 'bn' check (lang in ('bn', 'en')),
  category text not null check (category in (
    'national', 'politics', 'economy', 'international',
    'tech', 'sports', 'entertainment', 'regional', 'factcheck'
  )),
  region text not null default 'national',

  -- Bilingual Editorial Content
  title_bn text not null,
  title_en text not null,
  summary_bn text not null,
  summary_en text not null,
  body_bn text,
  body_en text,

  -- Cross-Source Verification Metadata
  verification_status text not null default 'single_source'
    check (verification_status in ('verified', 'corroborated', 'single_source', 'fact_check', 'disputed')),
  confidence_score smallint not null default 60 check (confidence_score between 0 and 100),
  source_count smallint not null default 1 check (source_count >= 1),
  primary_source text not null,
  primary_source_bn text not null,
  source_url text not null,

  -- Image CDN Wrapper Reference (Zero local image storage / Zero direct publisher association)
  image_cdn_token text,
  image_alt_bn text,
  image_alt_en text,
  image_caption_bn text,
  image_caption_en text,
  image_width integer default 1200,
  image_height integer default 675,

  -- Per-Article SEO
  seo_title_bn text,
  seo_title_en text,
  seo_desc_bn text,
  seo_desc_en text,
  keywords text[] not null default '{}',

  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  is_breaking boolean not null default false,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_articles_published on public.articles (status, published_at desc);
create index if not exists idx_articles_category on public.articles (category, published_at desc);
create index if not exists idx_articles_verification on public.articles (verification_status, published_at desc);
create index if not exists idx_articles_slug on public.articles (slug);

-- 3. Corroborating Source Links per Article (Audit Trail for Fact-Checking)
create table if not exists public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references public.articles(id) on delete cascade,
  source_id text references public.sources(id) on delete set null,
  source_name_en text not null,
  source_name_bn text not null,
  source_domain text not null,
  original_url text not null,
  original_headline text not null,
  tier smallint not null default 2,
  captured_at timestamptz not null default now(),
  unique (article_id, source_domain)
);

create index if not exists idx_article_sources_article on public.article_sources (article_id);

-- 4. Dedicated Fact-Check Claims Ledger
create table if not exists public.fact_checks (
  id text primary key,
  article_id text references public.articles(id) on delete set null,
  claim_bn text not null,
  claim_en text not null,
  verdict text not null check (verdict in ('true', 'mostly_true', 'misleading', 'false', 'unverified')),
  explanation_bn text not null,
  explanation_en text not null,
  evidence_urls text[] not null default '{}',
  checked_by text not null default 'Cross-Source Verifier',
  checked_at timestamptz not null default now()
);

-- 5. Personal Access Tokens (PAT) — Hashed with SHA-256 (never stored in plaintext)
create table if not exists public.pat_tokens (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array['news:write', 'factcheck:write'],
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 6. Ingestion & Revalidation Audit Log
create table if not exists public.ingest_logs (
  id uuid primary key default gen_random_uuid(),
  pat_id uuid references public.pat_tokens(id) on delete set null,
  pat_label text not null,
  articles_upserted integer not null default 0,
  sources_scanned integer not null default 0,
  revalidated_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Updated-at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_articles_touch on public.articles;
create trigger trg_articles_touch
  before update on public.articles
  for each row execute function public.touch_updated_at();
