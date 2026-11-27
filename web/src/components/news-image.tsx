"use client";

import React, { useState } from "react";
import type { Language } from "@/lib/types";

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
}: NewsImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return null;
  }

  return (
    <div className={`relative w-full overflow-hidden bg-muted ${aspectClass} ${className}`}>
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
    </div>
  );
}
