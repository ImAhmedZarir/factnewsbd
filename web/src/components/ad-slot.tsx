"use client";

interface AdSlotProps {
  slot: "leaderboard" | "sidebar" | "in-article";
}

/**
 * Zero-CLS AdSense slot component.
 * Stays cleanly hidden until NEXT_PUBLIC_ADSENSE_CLIENT is configured so the
 * frontpage never displays ugly empty placeholder boxes.
 */
export function AdSlot({ slot }: AdSlotProps) {
  const adsEnabled = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!adsEnabled) return null;

  const sizeClass =
    slot === "leaderboard"
      ? "min-h-[90px] w-full"
      : slot === "sidebar"
        ? "min-h-[250px] w-full"
        : "min-h-[120px] w-full";

  return (
    <aside
      aria-label="Advertisement"
      className={`flex items-center justify-center rounded-md border border-border/60 bg-card/70 ${sizeClass}`}
    >
      <ins
        className="adsbygoogle block w-full"
        data-ad-client={adsEnabled}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
