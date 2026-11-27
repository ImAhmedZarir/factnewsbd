"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { CATEGORIES, formatNewsTime, toBengaliDigits, UI_COPY } from "@/lib/i18n";
import { mapSupabaseArticleRow } from "@/lib/supabase-mapper";
import type { Article, NewsCategory } from "@/lib/types";
import { AdSlot } from "./ad-slot";
import { useLanguage } from "./language-provider";
import { NewsImage } from "./news-image";
import { ShareBar } from "./share-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SourcePills } from "./source-pills";

interface NewsFrontpageProps {
  articles: Article[];
  initialCategory?: NewsCategory;
}

export function NewsFrontpage({
  articles: initialArticles,
  initialCategory = "all",
}: NewsFrontpageProps) {
  const { lang } = useLanguage();
  const copy = UI_COPY[lang];
  const [articles, setArticles] = useState<Article[]>(() =>
    [...initialArticles].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)),
  );
  const [category, setCategory] = useState<NewsCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [railTab, setRailTab] = useState<"latest" | "popular">("latest");
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [hasMoreArchive, setHasMoreArchive] = useState(true);

  const loadOlderArchive = async () => {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!sbUrl || !anonKey || loadingArchive) return;
    setLoadingArchive(true);
    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/articles?select=*,article_sources(*)&status=eq.published&order=published_at.desc&limit=120&offset=${articles.length}`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      );
      if (res.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        if (!Array.isArray(rows) || rows.length === 0) {
          setHasMoreArchive(false);
        } else {
          const nextItems = rows.map((r) => mapSupabaseArticleRow(r));
          setArticles((prev) => {
            const seen = new Set(prev.map((p) => p.slug));
            const merged = [...prev];
            for (const item of nextItems) {
              if (!seen.has(item.slug)) merged.push(item);
            }
            return merged.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
          });
          if (rows.length < 120) setHasMoreArchive(false);
        }
      }
    } finally {
      setLoadingArchive(false);
    }
  };

  useEffect(() => {
    try {
      const cat = new URLSearchParams(window.location.search).get("category") as NewsCategory | null;
      if (
        cat &&
        [
          "all",
          "national",
          "politics",
          "economy",
          "international",
          "sports",
          "tech",
          "entertainment",
          "regional",
        ].includes(cat)
      ) {
        setCategory(cat);
      }
    } catch {
      // ignore
    }
  }, []);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((art) => {
      if (category !== "all" && art.category !== category) return false;
      if (q) {
        const hay = `${art.title_bn} ${art.title_en} ${art.summary_bn} ${art.summary_en} ${art.primary_source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [articles, category, searchQuery]);

  const isFilteredView = category !== "all" || searchQuery.trim().length > 0;

  // Classic 3-Column Broadsheet Hero Slices (Prothom Alo / Daily Star / Dhaka Post style)
  const leadHero = filteredArticles[0] ?? null;
  const leftColumnStories = filteredArticles.slice(1, 4);
  const subHeroPair = filteredArticles.slice(4, 6);
  const rightRailStories =
    railTab === "latest"
      ? articles.slice(0, 6)
      : [...articles].sort((a, b) => b.source_count - a.source_count).slice(0, 6);

  // Category Blocks below the fold on frontpage
  const usedInHero = new Set([
    leadHero?.id,
    ...leftColumnStories.map((a) => a.id),
    ...subHeroPair.map((a) => a.id),
  ]);

  const bangladeshSection = useMemo(
    () =>
      articles
        .filter((a) => !usedInHero.has(a.id) && (a.category === "national" || a.category === "politics"))
        .slice(0, 4),
    [articles, usedInHero],
  );
  const economyWorldSection = useMemo(
    () =>
      articles
        .filter((a) => !usedInHero.has(a.id) && (a.category === "economy" || a.category === "international"))
        .slice(0, 4),
    [articles, usedInHero],
  );
  const moreNewsSection = useMemo(
    () =>
      articles
        .filter(
          (a) =>
            !usedInHero.has(a.id) &&
            !bangladeshSection.some((b) => b.id === a.id) &&
            !economyWorldSection.some((e) => e.id === a.id),
        )
        .slice(0, 40),
    [articles, usedInHero, bangladeshSection, economyWorldSection],
  );

  const getTitle = (a: Article) => (lang === "bn" ? a.title_bn : a.title_en);
  const getSummary = (a: Article) => (lang === "bn" ? a.summary_bn : a.summary_en);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <SiteHeader
        activeCategory={category}
        onSelectCategory={setCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 lg:px-8">
        {/* Trending Topic Pill Strip (JagoNews24 / Dhaka Post style) */}
        <div className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-border pb-3 no-scrollbar">
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
            <TrendingUp className="size-3.5" aria-hidden="true" />
            <span>{copy.trendingLabel}</span>
          </span>
          {CATEGORIES.slice(1, 8).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                category === cat.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-foreground hover:border-primary/40 hover:text-primary"
              }`}
            >
              {lang === "bn" ? cat.bn : cat.en}
            </button>
          ))}
        </div>

        <AdSlot slot="leaderboard" />

        {!leadHero ? (
          <div className="rounded-sm border border-border bg-card p-10 text-center">
            <p className="text-base font-medium text-foreground">{copy.noArticles}</p>
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setSearchQuery("");
              }}
              className="mt-4 inline-flex min-h-10 items-center rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              {copy.resetFilter}
            </button>
          </div>
        ) : isFilteredView ? (
          /* Filtered Category / Search View */
          <section>
            <div className="mb-5 flex items-center justify-between border-b-2 border-primary pb-2">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {CATEGORIES.find((c) => c.id === category)?.[lang] || copy.moreNews}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  setSearchQuery("");
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {copy.resetFilter}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((art) => (
                <article
                  key={art.id}
                  className="group flex flex-col justify-between border-b border-border pb-4"
                >
                  <div>
                    <Link href={`/news/${art.slug}`} className="block">
                      <NewsImage
                        src={art.image_cdn_url}
                        alt={getTitle(art)}
                        aspectClass="aspect-video"
                        className="rounded-sm"
                      />
                      <h2 className="mt-3 font-display text-lg font-bold leading-snug text-foreground group-hover:text-primary">
                        {getTitle(art)}
                      </h2>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                        {getSummary(art)}
                      </p>
                    </Link>
                  </div>
                  <div className="mt-3 space-y-2">
                    <SourcePills article={art} lang={lang} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular">{formatNewsTime(art.published_at, lang)}</span>
                      <ShareBar title={getTitle(art)} urlPath={`/news/${art.slug}`} lang={lang} compact />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <>
            {/* Section 1: Classic 3-Column Broadsheet Frontpage (Prothom Alo + Daily Star + Dhaka Tribune) */}
            <section className="grid grid-cols-1 gap-6 border-b border-border pb-8 lg:grid-cols-12 lg:gap-0">
              {/* Left Rail (3 cols): Stacked Stories with Right Thumbnails */}
              <div className="order-2 flex flex-col divide-y divide-border lg:order-1 lg:col-span-3 lg:border-r lg:border-border lg:pr-5">
                {leftColumnStories.map((art) => (
                  <article key={art.id} className="group py-4 first:pt-0 last:pb-0">
                    <Link href={`/news/${art.slug}`} className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                          {getTitle(art)}
                        </h2>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getSummary(art)}
                        </p>
                      </div>
                      {art.image_cdn_url && (
                        <div className="w-24 shrink-0 overflow-hidden rounded-sm">
                          <NewsImage
                            src={art.image_cdn_url}
                            alt={getTitle(art)}
                            eager={true}
                            aspectClass="aspect-[4/3]"
                          />
                        </div>
                      )}
                    </Link>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <SourcePills article={art} lang={lang} maxCount={2} />
                      <span className="tabular text-[11px] text-muted-foreground">
                        {formatNewsTime(art.published_at, lang)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              {/* Center Lead Zone (6 cols): Main Lead Hero + 2-Up Sub-Hero Cards */}
              <div className="order-1 lg:order-2 lg:col-span-6 lg:px-6">
                <article className="group border-b border-border pb-5">
                  <Link href={`/news/${leadHero.slug}`} className="block">
                    <NewsImage
                      src={leadHero.image_cdn_url}
                      alt={getTitle(leadHero)}
                      priority={true}
                      aspectClass="aspect-video"
                      className="rounded-sm"
                    />
                    <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-foreground group-hover:text-primary sm:text-3xl">
                      {getTitle(leadHero)}
                    </h1>
                    <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {getSummary(leadHero)}
                    </p>
                  </Link>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <SourcePills article={leadHero} lang={lang} maxCount={3} />
                      <div className="tabular text-xs text-muted-foreground">
                        {formatNewsTime(leadHero.published_at, lang)}
                      </div>
                    </div>
                    <ShareBar
                      title={getTitle(leadHero)}
                      urlPath={`/news/${leadHero.slug}`}
                      lang={lang}
                      compact
                    />
                  </div>
                </article>

                {/* Sub-Hero 2-Column Row */}
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:divide-x sm:divide-border">
                  {subHeroPair.map((art, idx) => (
                    <article
                      key={art.id}
                      className={`group flex flex-col justify-between ${
                        idx === 0 ? "sm:pr-5" : "sm:pl-1"
                      }`}
                    >
                      <Link href={`/news/${art.slug}`} className="block">
                        <NewsImage
                          src={art.image_cdn_url}
                          alt={getTitle(art)}
                          aspectClass="aspect-[3/2]"
                          className="rounded-sm"
                        />
                        <h2 className="mt-2.5 font-display text-lg font-bold leading-snug text-foreground group-hover:text-primary">
                          {getTitle(art)}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getSummary(art)}
                        </p>
                      </Link>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <SourcePills article={art} lang={lang} maxCount={2} />
                        <span className="tabular text-[11px] text-muted-foreground">
                          {formatNewsTime(art.published_at, lang)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* Right Rail (3 cols): Latest / Most Read Tabs (Dhaka Tribune / JagoNews24 Style) */}
              <aside className="order-3 lg:col-span-3 lg:border-l lg:border-border lg:pl-5">
                <div className="grid grid-cols-2 border border-border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setRailTab("latest")}
                    className={`py-2.5 text-center ${
                      railTab === "latest"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-muted"
                    }`}
                  >
                    {copy.latestTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRailTab("popular")}
                    className={`py-2.5 text-center ${
                      railTab === "popular"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground hover:bg-muted"
                    }`}
                  >
                    {copy.popularTab}
                  </button>
                </div>

                <ol className="mt-2 divide-y divide-border">
                  {rightRailStories.map((item, idx) => (
                    <li key={item.id} className="group py-3 last:pb-0">
                      <Link href={`/news/${item.slug}`} className="flex items-start gap-2.5">
                        <span className="tabular mt-0.5 text-sm font-bold text-primary">
                          {lang === "bn" ? toBengaliDigits(idx + 1) : idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                            {getTitle(item)}
                          </h3>
                          <span className="mt-1 block tabular text-[11px] text-muted-foreground">
                            {formatNewsTime(item.published_at, lang)}
                          </span>
                        </div>
                        {item.image_cdn_url && (
                          <div className="w-20 shrink-0 overflow-hidden rounded-sm">
                            <NewsImage
                              src={item.image_cdn_url}
                              alt={getTitle(item)}
                              eager={true}
                              aspectClass="aspect-[4/3]"
                            />
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>

                <div className="mt-5">
                  <AdSlot slot="sidebar" />
                </div>
              </aside>
            </section>

            {/* Section 2: Bangladesh & Politics (4-Col Photo Grid) */}
            {bangladeshSection.length > 0 && (
              <section className="mt-8 border-b border-border pb-8">
                <div className="mb-4 flex items-center justify-between border-b-2 border-primary pb-2">
                  <h2 className="font-display text-xl font-bold text-foreground">
                    {lang === "bn" ? "বাংলাদেশ ও রাজনীতি" : "Bangladesh & Politics"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCategory("national")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <span>{copy.moreNews}</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {bangladeshSection.map((art) => (
                    <article key={art.id} className="group flex flex-col justify-between">
                      <Link href={`/news/${art.slug}`} className="block">
                        <NewsImage
                          src={art.image_cdn_url}
                          alt={getTitle(art)}
                          aspectClass="aspect-[16/10]"
                          className="rounded-sm"
                        />
                        <h3 className="mt-2.5 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                          {getTitle(art)}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getSummary(art)}
                        </p>
                      </Link>
                      <div className="mt-2.5 space-y-1.5">
                        <SourcePills article={art} lang={lang} maxCount={2} />
                        <span className="block tabular text-[11px] text-muted-foreground">
                          {formatNewsTime(art.published_at, lang)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Section 3: Economy & World (4-Col Photo Grid) */}
            {economyWorldSection.length > 0 && (
              <section className="mt-8 border-b border-border pb-8">
                <div className="mb-4 flex items-center justify-between border-b-2 border-foreground pb-2">
                  <h2 className="font-display text-xl font-bold text-foreground">
                    {lang === "bn" ? "অর্থনীতি ও আন্তর্জাতিক" : "Economy & World"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCategory("economy")}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <span>{copy.moreNews}</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {economyWorldSection.map((art) => (
                    <article key={art.id} className="group flex flex-col justify-between">
                      <Link href={`/news/${art.slug}`} className="block">
                        <NewsImage
                          src={art.image_cdn_url}
                          alt={getTitle(art)}
                          aspectClass="aspect-[16/10]"
                          className="rounded-sm"
                        />
                        <h3 className="mt-2.5 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                          {getTitle(art)}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getSummary(art)}
                        </p>
                      </Link>
                      <div className="mt-2.5 space-y-1.5">
                        <SourcePills article={art} lang={lang} maxCount={2} />
                        <span className="block tabular text-[11px] text-muted-foreground">
                          {formatNewsTime(art.published_at, lang)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Section 4: Sports, Tech, Culture & Nationwide */}
            {moreNewsSection.length > 0 && (
              <section className="mt-8">
                <div className="mb-4 flex items-center justify-between border-b-2 border-border pb-2">
                  <h2 className="font-display text-xl font-bold text-foreground">
                    {lang === "bn" ? "সারাদেশ, খেলা ও প্রযুক্তি" : "Nationwide, Sports & Tech"}
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {moreNewsSection.map((art) => (
                    <article key={art.id} className="group flex flex-col justify-between border-b border-border pb-4 lg:border-b-0 lg:pb-0">
                      <Link href={`/news/${art.slug}`} className="block">
                        <NewsImage
                          src={art.image_cdn_url}
                          alt={getTitle(art)}
                          aspectClass="aspect-[16/10]"
                          className="rounded-sm"
                        />
                        <h3 className="mt-2.5 font-display text-base font-bold leading-snug text-foreground group-hover:text-primary">
                          {getTitle(art)}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getSummary(art)}
                        </p>
                      </Link>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <SourcePills article={art} lang={lang} maxCount={1} />
                        <ShareBar title={getTitle(art)} urlPath={`/news/${art.slug}`} lang={lang} compact />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {hasMoreArchive && process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <div className="mt-10 flex justify-center border-t border-border pt-6">
            <button
              type="button"
              onClick={loadOlderArchive}
              disabled={loadingArchive}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {loadingArchive
                ? lang === "bn"
                  ? "আর্কাইভ লোড হচ্ছে..."
                  : "Loading 10-day archive..."
                : lang === "bn"
                  ? "গত ১০ দিনের আরও সংবাদ দেখুন"
                  : "Load older 10-day stories"}
            </button>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
