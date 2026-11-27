"use client";

import { CheckCircle2, ExternalLink } from "lucide-react";
import { UI_COPY } from "@/lib/i18n";
import { safeHttpUrl } from "@/lib/security";
import type { Article, Language } from "@/lib/types";

interface SourcePillsProps {
  article: Article;
  lang: Language;
  maxCount?: number;
}

export function SourcePills({ article, lang, maxCount = 3 }: SourcePillsProps) {
  const copy = UI_COPY[lang];
  const sources =
    article.sources.length > 0
      ? article.sources.slice(0, maxCount)
      : [
          {
            sourceId: "primary",
            nameEn: article.primary_source,
            nameBn: article.primary_source_bn,
            domain: "",
            url: article.source_url,
            tier: 1,
            headline: article.title_bn,
          },
        ];

  const isMulti = sources.length >= 2;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span
        className={`inline-flex items-center gap-1 font-semibold ${
          isMulti ? "text-success" : "text-muted-foreground"
        }`}
      >
        {isMulti && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />}
        <span>{isMulti ? copy.verifiedBy : copy.sourceLabel}</span>
      </span>

      {sources.map((src) => (
        <a
          key={src.url}
          href={safeHttpUrl(src.url)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-medium text-foreground hover:border-primary/50 hover:text-primary"
        >
          <span>{lang === "bn" ? src.nameBn : src.nameEn}</span>
          <ExternalLink className="size-2.5 opacity-70" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
