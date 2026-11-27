"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
import { CATEGORIES, SITE_BRAND, UI_COPY } from "@/lib/i18n";
import type { NewsCategory } from "@/lib/types";
import {
  BrandEmblem,
  FacebookIcon,
  TelegramIcon,
  WhatsAppIcon,
  XSocialIcon,
  YouTubeIcon,
} from "./brand-icons";
import { useLanguage } from "./language-provider";

interface SiteHeaderProps {
  activeCategory?: NewsCategory;
  onSelectCategory?: (category: NewsCategory) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export function SiteHeader({
  activeCategory = "all",
  onSelectCategory,
  searchQuery = "",
  onSearchChange,
}: SiteHeaderProps) {
  const { lang, setLang } = useLanguage();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);

  const brand = SITE_BRAND[lang];
  const copy = UI_COPY[lang];

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const schemeValue = nextDark ? "dark" : "light";
    try {
      localStorage.setItem("color-scheme", schemeValue);
      document
        .querySelector('meta[name="color-scheme"]')
        ?.setAttribute("content", schemeValue);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle("dark", nextDark);
  };

  const openDrawer = () => drawerRef.current?.showModal();
  const closeDrawer = () => {
    drawerRef.current?.close();
    openBtnRef.current?.focus();
  };

  const todayFormatted = mounted
    ? new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date())
    : "";

  return (
    <>
      {/* Non-sticky Masthead */}
      <header className="border-b border-border bg-card">
        <div className="border-b border-border/80 bg-muted/60">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              {todayFormatted && <span className="truncate font-medium">{todayFormatted}</span>}
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-1 border-r border-border pr-3 sm:flex">
                <a
                  href="https://www.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="inline-flex size-6 items-center justify-center rounded-sm text-[#1877F2] transition-opacity hover:opacity-80"
                >
                  <FacebookIcon className="size-3.5" />
                </a>
                <a
                  href="https://www.youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="inline-flex size-6 items-center justify-center rounded-sm text-[#FF0000] transition-opacity hover:opacity-80"
                >
                  <YouTubeIcon className="size-3.5" />
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  className="inline-flex size-6 items-center justify-center rounded-sm text-foreground transition-opacity hover:opacity-80"
                >
                  <XSocialIcon className="size-3.5" />
                </a>
                <a
                  href="https://api.whatsapp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="inline-flex size-6 items-center justify-center rounded-sm text-[#16A34A] transition-opacity hover:opacity-80"
                >
                  <WhatsAppIcon className="size-3.5" />
                </a>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex size-7 items-center justify-center rounded-sm border border-border bg-card text-foreground hover:border-primary/40"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="size-3.5" aria-hidden="true" /> : <Moon className="size-3.5" aria-hidden="true" />}
              </button>

              <div
                className="inline-flex items-center rounded-sm border border-border bg-card p-0.5"
                role="group"
                aria-label="Language switcher"
              >
                <button
                  type="button"
                  onClick={() => setLang("bn")}
                  aria-pressed={lang === "bn"}
                  className={`min-h-6 rounded-[2px] px-2.5 text-xs font-bold transition-colors ${
                    lang === "bn"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  aria-pressed={lang === "en"}
                  className={`min-h-6 rounded-[2px] px-2.5 text-xs font-bold transition-colors ${
                    lang === "en"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ENGLISH
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Masthead Brand Row */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={openBtnRef}
              type="button"
              onClick={openDrawer}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-foreground hover:border-primary/40 lg:hidden"
              aria-label={lang === "bn" ? "মেনু খুলুন" : "Open menu"}
              aria-controls="mobile-nav-drawer"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <Link href="/" className="group flex min-w-0 items-center gap-2.5">
              <BrandEmblem className="size-9 shrink-0 sm:size-11" />
              <div className="min-w-0">
                <div className="font-display text-xl font-bold tracking-tight whitespace-nowrap sm:text-3xl leading-none">
                  <span className="text-foreground">{brand.shortLeft}</span>{" "}
                  <span className="text-primary">{brand.shortRight}</span>
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold tracking-wide text-muted-foreground sm:text-xs">
                  {brand.tagline}
                </p>
              </div>
            </Link>
          </div>

          {onSearchChange && (
            <div className="flex items-center gap-2">
              <div className="hidden w-60 items-center rounded-sm border border-border bg-background px-3 focus-within:border-primary md:flex lg:w-72">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  aria-label={copy.searchPlaceholder}
                  className="h-9 w-full bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="inline-flex size-10 items-center justify-center rounded-sm border border-border bg-background text-foreground md:hidden"
                aria-label={copy.searchPlaceholder}
                aria-expanded={searchOpen}
              >
                <Search className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {searchOpen && onSearchChange && (
          <div className="border-t border-border bg-background px-4 py-2.5 md:hidden">
            <div className="flex items-center rounded-sm border border-border bg-card px-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-10 w-full bg-transparent px-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
        )}
      </header>

      {/* Single Compact Sticky Navigation Bar — evenly distributed full-width */}
      <nav
        aria-label="Primary"
        className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md"
      >
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center justify-between gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {CATEGORIES.map((cat) => {
            const isHome = pathname === "/";
            const isCurrent = isHome && activeCategory === cat.id;

            const navClass = `relative shrink-0 border-b-2 px-2.5 py-3 text-sm font-semibold whitespace-nowrap sm:px-3 ${
              isCurrent
                ? "border-primary text-primary"
                : "border-transparent text-foreground hover:text-primary"
            }`;

            if (isHome && onSelectCategory) {
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={navClass}
                >
                  {lang === "bn" ? cat.bn : cat.en}
                </button>
              );
            }

            const targetHref = cat.id === "all" ? "/" : `/?category=${cat.id}`;
            return (
              <Link
                key={cat.id}
                href={targetHref}
                aria-current={isCurrent ? "page" : undefined}
                className={navClass}
              >
                {lang === "bn" ? cat.bn : cat.en}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Accessible Native Mobile Drawer (<dialog>) */}
      <dialog
        ref={drawerRef}
        id="mobile-nav-drawer"
        aria-label={lang === "bn" ? "নেভিগেশন মেনু" : "Navigation drawer"}
        className="mobile-drawer"
        onClick={(e) => {
          if (e.target === drawerRef.current) closeDrawer();
        }}
      >
        <div className="flex h-[100svh] w-[min(20rem,84dvw)] flex-col border-r border-border bg-card p-5 text-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <BrandEmblem className="size-8" />
              <span className="font-display text-base font-bold">{brand.name}</span>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              autoFocus
              aria-label={lang === "bn" ? "মেনু বন্ধ করুন" : "Close menu"}
              className="inline-flex size-10 items-center justify-center rounded-sm border border-border text-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={cat.id === "all" ? "/" : `/?category=${cat.id}`}
                onClick={() => {
                  if (pathname === "/" && onSelectCategory) {
                    onSelectCategory(cat.id);
                  }
                  closeDrawer();
                }}
                className="flex min-h-11 items-center rounded-sm px-3 py-2 text-sm font-semibold hover:bg-muted"
              >
                {lang === "bn" ? cat.bn : cat.en}
              </Link>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border text-[#1877F2]"
              >
                <FacebookIcon className="size-4" />
              </a>
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border text-[#FF0000]"
              >
                <YouTubeIcon className="size-4" />
              </a>
              <a
                href="https://api.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border text-[#16A34A]"
              >
                <WhatsAppIcon className="size-4" />
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border text-[#0284C7]"
              >
                <TelegramIcon className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
