"use client";

import { useLanguage } from "./language-provider";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface PolicyPageShellProps {
  titleBn: string;
  titleEn: string;
  sections: {
    headingBn: string;
    headingEn: string;
    bodyBn: string;
    bodyEn: string;
  }[];
}

export function PolicyPageShell({ titleBn, titleEn, sections }: PolicyPageShellProps) {
  const { lang } = useLanguage();

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="border-b border-border pb-4 font-display text-3xl font-bold text-foreground">
          {lang === "bn" ? titleBn : titleEn}
        </h1>
        <div className="mt-6 space-y-6">
          {sections.map((sec) => (
            <section key={sec.headingEn} className="rounded-sm border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold text-foreground">
                {lang === "bn" ? sec.headingBn : sec.headingEn}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {lang === "bn" ? sec.bodyBn : sec.bodyEn}
              </p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
