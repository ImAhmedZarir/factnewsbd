"use client";

import { useEffect, useRef } from "react";

interface AdSlotProps {
  slot: "leaderboard" | "sidebar" | "in-article";
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const SLOT_ID_BY_POSITION: Record<AdSlotProps["slot"], string | undefined> = {
  leaderboard: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEADERBOARD,
  sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
  "in-article": process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE,
};

/**
 * Zero-CLS Google AdSense container.
 * Remains invisible until NEXT_PUBLIC_ADSENSE_CLIENT is set, and triggers
 * adsbygoogle.push({}) cleanly per slot without layout shifts.
 */
export function AdSlot({ slot }: AdSlotProps) {
  const adsClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!adsClient || pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ignore AdSense blockers or pre-init races
    }
  }, [adsClient, slot]);

  if (!adsClient) return null;

  const sizeClass =
    slot === "leaderboard"
      ? "min-h-[90px] w-full"
      : slot === "sidebar"
        ? "min-h-[250px] w-full"
        : "min-h-[120px] w-full";

  const adSlotId = SLOT_ID_BY_POSITION[slot] || slot;

  return (
    <aside
      aria-label="Advertisement"
      className={`my-2 flex flex-col items-center justify-center rounded-sm border border-border/60 bg-card/50 p-1 ${sizeClass}`}
    >
      <span className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        Advertisement
      </span>
      <ins
        className="adsbygoogle block w-full"
        data-ad-client={adsClient}
        data-ad-slot={adSlotId}
        data-ad-format={slot === "in-article" ? "fluid" : "auto"}
        data-ad-layout={slot === "in-article" ? "in-article" : undefined}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
