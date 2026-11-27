"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, ExternalLink, Printer } from "lucide-react";
import { CATEGORIES, formatFullDate, formatNewsTime, UI_COPY } from "@/lib/i18n";
import { safeHttpUrl } from "@/lib/security";
import type { Article } from "@/lib/types";
import { AdSlot } from "./ad-slot";
import { useLanguage } from "./language-provider";
import { NewsImage } from "./news-image";
import { ShareBar } from "./share-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface ArticleReaderProps {
  article: Article;
  related: Article[];
  latest: Article[];
}

export function ArticleReader({ article, related, latest }: ArticleReaderProps) {
  const { lang } = useLanguage();
  const copy = UI_COPY[lang];
  const [fontStep, setFontStep] = useState<0 | 1 | 2>(1);

  const title = lang === "bn" ? article.title_bn : article.title_en;
  const summary = lang === "bn" ? article.summary_bn : article.summary_en;
  const fullBody = lang === "bn" ? article.body_bn || summary : article.body_en || summary;

  useEffect(() => {
    document.title = `${title} | FactNews Bangladesh`;
  }, [title]);
  const paragraphs = fullBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const catMeta = CATEGORIES.find((c) => c.id === article.category);
  const catLabel = catMeta ? (lang === "bn" ? catMeta.bn : catMeta.en) : article.category;

  const textSizeClass =
    fontStep === 0 ? "text-base leading-7" : fontStep === 1 ? "text-[17px] leading-8" : "text-xl leading-9";

  const sources =
    article.sources.length > 0
      ? article.sources
      : [
          {
            sourceId: "primary",
            nameEn: article.primary_source,
            nameBn: article.primary_source_bn,
            domain: "",
            url: article.source_url,
            tier: 1,
            headline: title,
          },
        ];

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <SiteHeader activeCategory={article.category} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Link href="/" className="text-muted-foreground hover:text-primary">
              {copy.backHome}
            </Link>
            <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <Link href={`/?category=${article.category}`} className="text-primary hover:underline">
              {catLabel}
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFontStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : 0))}
              className="min-h-8 rounded-sm border border-border bg-card px-2.5 text-xs font-semibold hover:border-primary/40"
            >
              {copy.fontSmaller}
            </button>
            <button
              type="button"
              onClick={() => setFontStep((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : 2))}
              className="min-h-8 rounded-sm border border-border bg-card px-2.5 text-xs font-semibold hover:border-primary/40"
            >
              {copy.fontLarger}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-8 items-center gap-1 rounded-sm border border-border bg-card px-2.5 text-xs font-semibold hover:border-primary/40"
            >
              <Printer className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{copy.printArticle}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Article Main Column (8 cols) */}
          <article className="lg:col-span-8">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>

            <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
              {summary}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-bold text-foreground">{copy.newsDesk}</span>
                <span className="mx-2">•</span>
                <span className="tabular">
                  {copy.publishedLabel} {formatFullDate(article.published_at, lang)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <ShareBar title={title} urlPath={`/news/${article.slug}`} lang={lang} />
            </div>

            {article.image_cdn_url && (
              <figure className="mt-6">
                <NewsImage
                  src={article.image_cdn_url}
                  alt={title}
                  priority={true}
                  aspectClass="aspect-video"
                  className="rounded-sm"
                />
                <figcaption className="mt-2 border-b border-border pb-2 text-xs text-muted-foreground">
                  {article.image_alt || title}
                </figcaption>
              </figure>
            )}

            {/* Full Multi-Paragraph Detailed News Body */}
            <div className={`mt-6 max-w-[68ch] space-y-5 text-foreground ${textSizeClass}`}>
              {paragraphs.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>

            <div className="my-6">
              <AdSlot slot="in-article" />
            </div>

            {/* Clean Verified Publisher Attribution Links */}
            <section className="mt-8 rounded-sm border border-border bg-secondary/40 p-5">
              <div className="flex items-center gap-2 border-b border-border pb-2.5">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-foreground">
                  {sources.length >= 2
                    ? lang === "bn"
                      ? "একাধিক বিশ্বস্ত সংবাদমাধ্যমে যাচাইকৃত"
                      : "Verified Across Trusted News Outlets"
                    : lang === "bn"
                      ? "সংবাদ সূত্র"
                      : "News Source"}
                </h2>
              </div>

              <div className="mt-3 flex flex-wrap gap-2.5">
                {sources.map((src) => (
                  <a
                    key={src.url}
                    href={safeHttpUrl(src.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <span>{lang === "bn" ? src.nameBn : src.nameEn}</span>
                    <ExternalLink className="size-3.5 text-primary" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>

            {/* Related Articles */}
            {related.length > 0 && (
              <section className="mt-10 border-t border-border pt-6">
                <h2 className="mb-4 font-display text-xl font-bold text-foreground">
                  {copy.relatedStories}
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  {related.map((rel) => (
                    <Link key={rel.id} href={`/news/${rel.slug}`} className="group block">
                      <NewsImage
                        src={rel.image_cdn_url}
                        alt={lang === "bn" ? rel.title_bn : rel.title_en}
                        aspectClass="aspect-[16/10]"
                        className="rounded-sm"
                      />
                      <h3 className="mt-2 font-display text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                        {lang === "bn" ? rel.title_bn : rel.title_en}
                      </h3>
                      <span className="mt-1 block tabular text-[11px] text-muted-foreground">
                        {formatNewsTime(rel.published_at, lang)}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Right Sidebar (4 cols) */}
          <aside className="space-y-6 lg:col-span-4 lg:border-l lg:border-border lg:pl-6">
            <div>
              <h2 className="border-b-2 border-primary pb-2 font-display text-lg font-bold text-foreground">
                {copy.latestTab}
              </h2>
              <div className="divide-y divide-border">
                {latest.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={`/news/${item.slug}`}
                    className="group flex items-start gap-3 py-3.5 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                        {lang === "bn" ? item.title_bn : item.title_en}
                      </h3>
                      <span className="mt-1 block tabular text-[11px] text-muted-foreground">
                        {formatNewsTime(item.published_at, lang)}
                      </span>
                    </div>
                    {item.image_cdn_url && (
                      <div className="w-20 shrink-0 overflow-hidden rounded-sm">
                        <NewsImage
                          src={item.image_cdn_url}
                          alt={lang === "bn" ? item.title_bn : item.title_en}
                          eager={true}
                          aspectClass="aspect-[4/3]"
                        />
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            <AdSlot slot="sidebar" />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
