-- ============================================================================
-- 0002_rls_and_security.sql
-- Strict Read-Only Public Surface (Zero anonymous writes, Zero likes/comments)
-- All writes require Service Role + Validated PAT Token at API Gateway
-- ============================================================================

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_sources enable row level security;
alter table public.fact_checks enable row level security;
alter table public.pat_tokens enable row level security;
alter table public.ingest_logs enable row level security;

-- Public READ-ONLY policies (anon + authenticated can ONLY SELECT published data)
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

-- Explicitly deny public read/write on PAT tokens and ingest logs
-- (Only service_role bypasses RLS; zero anon/authenticated policies created)
revoke all on public.pat_tokens from anon, authenticated;
revoke all on public.ingest_logs from anon, authenticated;

-- Revoke all write permissions from anon/authenticated across content tables
revoke insert, update, delete on public.sources from anon, authenticated;
revoke insert, update, delete on public.articles from anon, authenticated;
revoke insert, update, delete on public.article_sources from anon, authenticated;
revoke insert, update, delete on public.fact_checks from anon, authenticated;
