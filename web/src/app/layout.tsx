import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language-provider";
import { safeJsonLd } from "@/lib/security";
import "./globals.css";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
  /\/$/,
  "",
);
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

export const metadata: Metadata = {
  title: {
    default: "FactNews Bangladesh • ফ্যাক্টনিউজ বাংলাদেশ",
    template: "%s | FactNews Bangladesh",
  },
  description:
    "FactNews Bangladesh — Independent bilingual digital newspaper delivering verified national, political, economic, sports, technology, and international news from Bangladesh.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    languages: {
      "bn-BD": "/",
      "en-US": "/",
    },
  },
  keywords: [
    "FactNews Bangladesh",
    "Bangladesh news",
    "Bangla news",
    "বাংলাদেশের খবর",
    "আজকের খবর",
    "ফ্যাক্টনিউজ বাংলাদেশ",
    "verified news Bangladesh",
    "Dhaka breaking news",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "FactNews Bangladesh",
    title: "FactNews Bangladesh • ফ্যাক্টনিউজ বাংলাদেশ",
    description:
      "Independent bilingual digital newspaper delivering verified multi-source journalism across Bangladesh.",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FactNews Bangladesh • ফ্যাক্টনিউজ বাংলাদেশ",
    description:
      "Verified bilingual breaking news, politics, economy, sports & world coverage from Bangladesh.",
  },
  verification: {
    // Set NEXT_PUBLIC_ADSENSE_CLIENT in Cloudflare Pages env to verify Google AdSense ownership
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsMediaOrganization",
        "@id": `${SITE_URL}/#organization`,
        name: "FactNews Bangladesh",
        alternateName: "ফ্যাক্টনিউজ বাংলাদেশ",
        url: SITE_URL,
        publishingPrinciples: `${SITE_URL}/about`,
        correctionsPolicy: `${SITE_URL}/contact`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "FactNews Bangladesh",
        inLanguage: ["bn-BD", "en-US"],
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="FactNews Bangladesh RSS Feed"
          href="/rss.xml"
        />
        {ADSENSE_CLIENT && <meta name="google-adsense-account" content={ADSENSE_CLIENT} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,600;6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("color-scheme");var m=document.querySelector('meta[name="color-scheme"]');if(m){m.setAttribute("content",s||"light dark");}var d=s==="dark"||((!s||s==="light dark")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="bg-background text-foreground antialiased selection:bg-primary/20">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
