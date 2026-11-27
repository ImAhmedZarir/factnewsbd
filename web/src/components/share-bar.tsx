"use client";

import React, { useState } from "react";
import { FacebookIcon, TelegramIcon, WhatsAppIcon, XSocialIcon } from "./brand-icons";
import { Check, Copy, Share2 } from "lucide-react";
import { UI_COPY } from "@/lib/i18n";
import type { Language } from "@/lib/types";

interface ShareBarProps {
  title: string;
  urlPath: string;
  lang: Language;
  compact?: boolean;
}

export function ShareBar({ title, urlPath, lang, compact = false }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const copy = UI_COPY[lang];

  const getAbsoluteUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${urlPath}`;
    }
    return urlPath;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getAbsoluteUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = getAbsoluteUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch {
        // cancelled
      }
    }
    await handleCopy();
  };

  const openShareWindow = (network: "fb" | "x" | "wa" | "tg") => {
    const shareUrl = encodeURIComponent(getAbsoluteUrl());
    const text = encodeURIComponent(title);
    const endpoints: Record<typeof network, string> = {
      fb: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      wa: `https://api.whatsapp.com/send?text=${text}%20${shareUrl}`,
      tg: `https://t.me/share/url?url=${shareUrl}&text=${text}`,
    };
    window.open(endpoints[network], "_blank", "noopener,noreferrer");
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => openShareWindow("fb")}
          title="Share on Facebook"
          aria-label="Share on Facebook"
          className="inline-flex size-8 items-center justify-center rounded-sm border border-border bg-background text-[#1877F2] hover:border-[#1877F2]/50 hover:bg-[#1877F2]/10"
        >
          <FacebookIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => openShareWindow("wa")}
          title="Share on WhatsApp"
          aria-label="Share on WhatsApp"
          className="inline-flex size-8 items-center justify-center rounded-sm border border-border bg-background text-[#16A34A] hover:border-[#16A34A]/50 hover:bg-[#16A34A]/10"
        >
          <WhatsAppIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => openShareWindow("x")}
          title="Share on X"
          aria-label="Share on X"
          className="inline-flex size-8 items-center justify-center rounded-sm border border-border bg-background text-foreground hover:border-foreground/40 hover:bg-muted"
        >
          <XSocialIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title={copy.copyLink}
          aria-label={copy.copyLink}
          className="inline-flex size-8 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Share2 className="size-3.5 text-primary" aria-hidden="true" />
        <span>{copy.shareLabel}</span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openShareWindow("fb")}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-[#1877F2]/30 bg-[#1877F2]/10 px-3 text-xs font-semibold text-[#1877F2] transition-colors hover:bg-[#1877F2] hover:text-white"
        >
          <FacebookIcon className="size-3.5" />
          <span>Facebook</span>
        </button>
        <button
          type="button"
          onClick={() => openShareWindow("wa")}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-[#16A34A]/30 bg-[#16A34A]/10 px-3 text-xs font-semibold text-[#15803D] dark:text-[#4ADE80] transition-colors hover:bg-[#16A34A] hover:text-white"
        >
          <WhatsAppIcon className="size-3.5" />
          <span>WhatsApp</span>
        </button>
        <button
          type="button"
          onClick={() => openShareWindow("x")}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <XSocialIcon className="size-3.5" />
          <span>X</span>
        </button>
        <button
          type="button"
          onClick={() => openShareWindow("tg")}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm border border-[#0284C7]/30 bg-[#0284C7]/10 px-3 text-xs font-semibold text-[#0284C7] dark:text-[#38BDF8] transition-colors hover:bg-[#0284C7] hover:text-white"
        >
          <TelegramIcon className="size-3.5" />
          <span>Telegram</span>
        </button>
        <button
          type="button"
          onClick={handleNativeShare}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-sm bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          <span>{copied ? copy.copied : copy.copyLink}</span>
        </button>
      </div>
    </div>
  );
}
