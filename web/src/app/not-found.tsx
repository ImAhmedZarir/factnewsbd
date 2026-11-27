"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArticleReader } from "@/components/article-reader";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { mapSupabaseArticleRow } from "@/lib/supabase-mapper";
import type { Article } from "@/lib/types";

export default function NotFoundPage() {
  const [state, setState] = useState<"checking" | "found" | "missing">("checking");
  const [article, setArticle] = useState<Article | null>(null);
  const [latest, setLatest] = useState<Article[]>([]);

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/+$/, "");
    const match = pathname.match(/^\/news\/([a-z0-9-]+)$/i);
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const cdnBase = (
      process.env.NEXT_PUBLIC_CDN_BASE_URL || "https://cdn.factnewsbangladesh.bond"
    ).replace(/\/$/, "");

    if (!match || !sbUrl || !anonKey) {
      setState("missing");
      return;
    }

    const slug = match[1]!;
    Promise.all([
      fetch(
        `${sbUrl}/rest/v1/articles?select=*,article_sources(*)&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      ).then((r) => (r.ok ? r.json() : [])),
      fetch(
        `${sbUrl}/rest/v1/articles?select=*,article_sources(*)&status=eq.published&order=published_at.desc&limit=12`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      ).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([rows, latestRows]) => {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
          setState("missing");
          return;
        }
        const art = mapSupabaseArticleRow(list[0] as Record<string, unknown>, cdnBase);
        const latestList = (Array.isArray(latestRows) ? latestRows : []).map((r) =>
          mapSupabaseArticleRow(r as Record<string, unknown>, cdnBase),
        );
        setArticle(art);
        setLatest(latestList.filter((l) => l.slug !== art.slug));
        setState("found");
      })
      .catch(() => setState("missing"));
  }, []);

  if (state === "found" && article) {
    const related = latest
      .filter((a) => a.category === article.category)
      .slice(0, 3);
    return <ArticleReader article={article} related={related} latest={latest.slice(0, 6)} />;
  }

  if (state === "checking") {
    return (
      <div className="min-h-dvh flex flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-4 aspect-video w-full animate-pulse rounded bg-muted" />
          <div className="mt-6 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <span className="tabular text-5xl font-extrabold text-primary">404</span>
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">
          সংবাদটি খুঁজে পাওয়া যায়নি
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          আপনি যে প্রতিবেদনটি খুঁজছেন তা সরানো হয়ে থাকতে পারে অথবা ঠিকানাটি সঠিক নয়।
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-10 items-center rounded-sm bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          প্রচ্ছদে ফিরে যান
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
