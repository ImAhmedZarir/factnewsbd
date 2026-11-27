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

      {/* Full-frame subtle diagonal crossmark + explicit source disclaimer watermark */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.45"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="100"
          y1="0"
          x2="0"
          y2="100"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="100"
          y1="0"
          x2="0"
          y2="100"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.45"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 select-none"
      >
        <span className="hidden rounded-[2px] border border-white/20 bg-black/35 px-2 py-0.5 text-center text-[9px] font-semibold tracking-wider text-white/85 backdrop-blur-[1px] @min-[340px]:inline-block sm:text-[10px]">
          {activeLang === "bn"
            ? "সংগৃহীত ছবি • আমাদের তোলা নয় (Collected · Not taken by us)"
            : "Collected · Not taken by us"}
        </span>
      </div>

      <span
        aria-label="Collected from different sources, not taken by us"
        className="pointer-events-none absolute right-1 bottom-1 max-w-[calc(100%-0.5rem)] truncate rounded-[2px] border border-white/15 bg-black/70 px-1.5 py-0.5 text-[7px] font-medium tracking-wide text-white/95 backdrop-blur-xs @min-[200px]:right-2 @min-[200px]:bottom-2 @min-[200px]:text-[9px]"
      >
        <span className="hidden @min-[200px]:inline">Collected · Not taken by us</span>
        <span className="@min-[200px]:hidden">Collected</span>
      </span>
    </div>
  );
}
