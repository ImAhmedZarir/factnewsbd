"use client";

import Link from "next/link";
import { CATEGORIES, SITE_BRAND } from "@/lib/i18n";
import {
  BrandEmblem,
  FacebookIcon,
  TelegramIcon,
  WhatsAppIcon,
  XSocialIcon,
  YouTubeIcon,
} from "./brand-icons";
import { useLanguage } from "./language-provider";

export function SiteFooter() {
  const { lang } = useLanguage();
  const brand = SITE_BRAND[lang];

  return (
    <footer className="mt-12 border-t-2 border-primary bg-card print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandEmblem className="size-9" />
              <div>
                <div className="font-display text-xl font-bold tracking-tight leading-none">
                  <span className="text-foreground">{brand.shortLeft}</span>{" "}
                  <span className="text-primary">{brand.shortRight}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-primary">{brand.tagline}</p>
              </div>
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {lang === "bn"
                ? "বাংলাদেশ ও আন্তর্জাতিক অঙ্গনের সর্বশেষ, নির্ভরযোগ্য এবং যাচাইকৃত সংবাদ পরিবেশনকারী ডিজিটাল নিউজ পোর্টাল।"
                : "Independent Bangladeshi digital newspaper delivering verified national, economic, political, and global news coverage."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {lang === "bn" ? "ইমেইল: " : "Email: "}
              <a
                href="mailto:contact@factnewsbangladesh.bond"
                className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                contact@factnewsbangladesh.bond
              </a>
            </p>

            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-[#1877F2] transition-colors hover:bg-[#1877F2] hover:text-white"
              >
                <FacebookIcon className="size-4" />
              </a>
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-[#FF0000] transition-colors hover:bg-[#FF0000] hover:text-white"
              >
                <YouTubeIcon className="size-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                <XSocialIcon className="size-4" />
              </a>
              <a
                href="https://api.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-[#16A34A] transition-colors hover:bg-[#16A34A] hover:text-white"
              >
                <WhatsAppIcon className="size-4" />
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-[#0284C7] transition-colors hover:bg-[#0284C7] hover:text-white"
              >
                <TelegramIcon className="size-4" />
              </a>
            </div>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "bn" ? "সংবাদ বিভাগ" : "Sections"}
            </h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {CATEGORIES.slice(1).map((cat) => (
                <li key={cat.id}>
                  <Link href={`/?category=${cat.id}`} className="hover:text-primary">
                    {lang === "bn" ? cat.bn : cat.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {lang === "bn" ? "তথ্য ও নীতিমালা" : "Editorial & Legal"}
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-primary">
                  {lang === "bn" ? "আমাদের সম্পর্কে" : "About Us"}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary">
                  {lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary">
                  {lang === "bn" ? "ব্যবহারের শর্তাবলি" : "Terms of Use"}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary">
                  {lang === "bn" ? "যোগাযোগ" : "Contact"}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:flex sm:items-center sm:justify-between sm:text-left">
          <span>© {new Date().getFullYear()} {brand.name} • সর্বস্বত্ব সংরক্ষিত</span>
          <span className="mt-1 block sm:mt-0">
            {lang === "bn" ? "স্বাধীন ডিজিটাল সংবাদমাধ্যম" : "Independent Digital Newspaper"}
          </span>
        </div>
      </div>
    </footer>
  );
}
