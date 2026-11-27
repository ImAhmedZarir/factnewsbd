"use client";

import React, { useState } from "react";
import type { Language } from "@/lib/types";
import { useLanguage } from "./language-provider";

interface NewsImageProps {
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  eager?: boolean;
  className?: string;
  aspectClass?: string;
  lang?: Language;
}

export function NewsImage({
  src,
  alt,
  priority = false,
  eager = false,
  className = "",
  aspectClass = "aspect-video",
  lang: propLang,
}: NewsImageProps) {
  const [failed, setFailed] = useState(false);
  const ctx = useLanguage();
  const activeLang = propLang ?? ctx.lang;

  if (!src || failed) {
    return null;
  }

  return (
    <div
      className={`@container relative w-full overflow-hidden bg-muted ${aspectClass} ${className}`}
    >
      <img
        src={src}
        alt={alt}
        width={1200}
        height={675}
        loading={priority || eager ? undefined : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding={priority ? "sync" : "async"}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <span
        aria-label="Collected from different sources"
        className="pointer-events-none absolute right-1.5 bottom-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-[2px] border border-white/15 bg-black/70 px-1.5 py-0.5 text-[7px] font-medium tracking-wide text-white/95 backdrop-blur-xs @min-[200px]:right-2 @min-[200px]:bottom-2 @min-[200px]:px-2 @min-[200px]:text-[10px]"
      >
        <span className="hidden @min-[200px]:inline">
          {activeLang === "bn"
            ? "সংগৃহীত ছবি • বিভিন্ন সূত্র"
            : "Collected from different sources"}
        </span>
        <span className="@min-[200px]:hidden">
          {activeLang === "bn" ? "সংগৃহীত" : "Sourced"}
        </span>
      </span>
    </div>
  );
}
