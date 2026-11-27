-- ============================================================================
-- FULL_SETUP_ONE_CLICK.sql
-- FactNews Bangladesh — Complete One-Click Supabase PostgreSQL Setup
-- Combines Schema + Strict Read-Only RLS Security + 30 Bangladeshi News Sources
-- Safe to re-run (idempotent). Paste entire file into Supabase SQL Editor -> Run.
-- ============================================================================

begin;

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

-- 2. Published Verified Articles (Text-only; images served via signed CDN token)
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

-- ============================================================================
-- Strict Read-Only RLS & Security Policies
-- ============================================================================

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_sources enable row level security;
alter table public.fact_checks enable row level security;
alter table public.pat_tokens enable row level security;
alter table public.ingest_logs enable row level security;

drop policy if exists "public_read_active_sources" on public.sources;
create policy "public_read_active_sources"
  on public.sources for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "public_read_published_articles" on public.articles;
create policy "public_read_published_articles"
  on public.articles for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "public_read_article_sources" on public.article_sources;
create policy "public_read_article_sources"
  on public.article_sources for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_sources.article_id and a.status = 'published'
    )
  );

drop policy if exists "public_read_fact_checks" on public.fact_checks;
create policy "public_read_fact_checks"
  on public.fact_checks for select
  to anon, authenticated
  using (true);

-- Explicit table privileges for Supabase roles (PostgreSQL requires GRANT + RLS)
grant usage on schema public to anon, authenticated, service_role;

grant select on public.sources to anon, authenticated;
grant select on public.articles to anon, authenticated;
grant select on public.article_sources to anon, authenticated;
grant select on public.fact_checks to anon, authenticated;

grant all privileges on public.sources to service_role;
grant all privileges on public.articles to service_role;
grant all privileges on public.article_sources to service_role;
grant all privileges on public.fact_checks to service_role;
grant all privileges on public.pat_tokens to service_role;
grant all privileges on public.ingest_logs to service_role;

-- Explicitly deny public read/write on PAT tokens and ingest logs
revoke all on public.pat_tokens from anon, authenticated;
revoke all on public.ingest_logs from anon, authenticated;

-- Revoke all write permissions from anon/authenticated across content tables
revoke insert, update, delete on public.sources from anon, authenticated;
revoke insert, update, delete on public.articles from anon, authenticated;
revoke insert, update, delete on public.article_sources from anon, authenticated;
revoke insert, update, delete on public.fact_checks from anon, authenticated;

-- ============================================================================
-- Seed 30 Bangladeshi National, Regional & Fact-Checking News Outlets
-- ============================================================================

insert into public.sources (id, name_en, name_bn, domain, lang, tier, region, rss_url, sitemap_url)
values
  ('prothomalo', 'Prothom Alo', 'প্রথম আলো', 'prothomalo.com', 'bn', 1, 'national', 'https://www.prothomalo.com/feed', 'https://www.prothomalo.com/news-sitemap.xml'),
  ('bdnews24-bn', 'bdnews24 Bangla', 'বিডিনিউজ২৪ বাংলা', 'bangla.bdnews24.com', 'bn', 1, 'national', 'https://bangla.bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true', null),
  ('samakal', 'Samakal', 'সমকাল', 'samakal.com', 'bn', 1, 'national', 'https://samakal.com/rss.xml', null),
  ('jugantor', 'Jugantor', 'যুগান্তর', 'jugantor.com', 'bn', 1, 'national', 'https://www.jugantor.com/feed/rss.xml', 'https://www.jugantor.com/news-sitemap.xml'),
  ('ittefaq', 'Daily Ittefaq', 'দৈনিক ইত্তেফাক', 'ittefaq.com.bd', 'bn', 1, 'national', 'https://www.ittefaq.com.bd/feed', null),
  ('kalerkantho', 'Kaler Kantho', 'কালের কণ্ঠ', 'kalerkantho.com', 'bn', 2, 'national', 'https://www.kalerkantho.com/rss.xml', null),
  ('bd-pratidin', 'Bangladesh Pratidin', 'বাংলাদেশ প্রতিদিন', 'bd-pratidin.com', 'bn', 2, 'national', 'https://www.bd-pratidin.com/rss.xml', null),
  ('bonikbarta', 'Bonik Barta', 'বণিক বার্তা', 'bonikbarta.com', 'bn', 1, 'national', 'https://bonikbarta.com/rss.xml', null),
  ('banglatribune', 'Bangla Tribune', 'বাংলা ট্রিবিউন', 'banglatribune.com', 'bn', 2, 'national', 'https://www.banglatribune.com/feed', null),
  ('dhakapost', 'Dhaka Post', 'ঢাকা পোস্ট', 'dhakapost.com', 'bn', 2, 'national', 'https://www.dhakapost.com/rss.xml', 'https://www.dhakapost.com/sitemap.xml'),
  ('jagonews24', 'Jagonews24', 'জাগোনিউজ২৪', 'jagonews24.com', 'bn', 2, 'national', 'https://www.jagonews24.com/rss/rss.xml', null),
  ('somoynews', 'Somoy News', 'সময় টিভি', 'somoynews.tv', 'bn', 2, 'national', 'https://www.somoynews.tv/rss.xml', null),
  ('jamunatv', 'Jamuna TV', 'যমুনা টিভি', 'jamuna.tv', 'bn', 2, 'national', 'https://jamuna.tv/feed', null),
  ('kalbela', 'Kalbela', 'কালবেলা', 'kalbela.com', 'bn', 2, 'national', 'https://www.kalbela.com/feed', null),
  ('deshrupantor', 'Desh Rupantor', 'দেশ রূপান্তর', 'deshrupantor.com', 'bn', 2, 'national', 'https://www.deshrupantor.com/feed', null),
  ('ajkerpatrika', 'Ajker Patrika', 'আজকের পত্রিকা', 'ajkerpatrika.com', 'bn', 2, 'national', 'https://www.ajkerpatrika.com/feed', null),
  ('mzamin', 'Manab Zamin', 'মানবজমিন', 'mzamin.com', 'bn', 2, 'national', 'https://mzamin.com/feed', null),
  ('nayadiganta', 'Naya Diganta', 'নয়া দিগন্ত', 'dailynayadiganta.com', 'bn', 2, 'national', 'https://www.dailynayadiganta.com/rss.xml', null),
  ('inqilab', 'Daily Inqilab', 'দৈনিক ইনকিলাব', 'dailyinqilab.com', 'bn', 2, 'national', 'https://dailyinqilab.com/feed', null),
  ('risingbd', 'RisingBD', 'রাইজিংবিডি', 'risingbd.com', 'bn', 2, 'national', 'https://www.risingbd.com/rss/rss.xml', null),
  ('dailystar', 'The Daily Star', 'দ্য ডেইলি স্টার', 'thedailystar.net', 'en', 1, 'national', 'https://www.thedailystar.net/frontpage/rss.xml', null),
  ('bdnews24-en', 'bdnews24.com', 'বিডিনিউজ২৪ ইংরেজি', 'bdnews24.com', 'en', 1, 'national', 'https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true', null),
  ('dhakatribune', 'Dhaka Tribune', 'ঢাকা ট্রিবিউন', 'dhakatribune.com', 'en', 1, 'national', 'https://www.dhakatribune.com/feed', null),
  ('tbsnews', 'The Business Standard', 'দ্য বিজনেস স্ট্যান্ডার্ড', 'tbsnews.net', 'en', 1, 'national', 'https://www.tbsnews.net/top-news/rss.xml', null),
  ('financialexpress', 'The Financial Express', 'ফাইন্যান্সিয়াল এক্সপ্রেস', 'thefinancialexpress.com.bd', 'en', 1, 'national', 'https://thefinancialexpress.com.bd/feed', null),
  ('newage', 'New Age', 'নিউ এজ', 'newagebd.net', 'en', 2, 'national', 'https://www.newagebd.net/rss', null),
  ('dainikazadi', 'Dainik Azadi (Chattogram)', 'দৈনিক আজাদী (চট্টগ্রাম)', 'dainikazadi.net', 'bn', 3, 'chattogram', 'https://dainikazadi.net/feed/', null),
  ('purbokone', 'Dainik Purbokone (Chattogram)', 'দৈনিক পূর্বকোণ (চট্টগ্রাম)', 'dainikpurbokone.net', 'bn', 3, 'chattogram', 'https://dainikpurbokone.net/feed/', null),
  ('rumorscanner', 'Rumor Scanner BD', 'রিউমর স্ক্যানার', 'rumorscanner.com', 'bn', 4, 'factcheck', 'https://rumorscanner.com/feed/', null),
  ('dismislab', 'Dismislab', 'ডিসমিসল্যাব', 'dismislab.com', 'bn', 4, 'factcheck', 'https://dismislab.com/feed/', null)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_bn = excluded.name_bn,
  rss_url = excluded.rss_url,
  sitemap_url = excluded.sitemap_url;

commit;
