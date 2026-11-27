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
    default:
      "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে | জাতীয়, রাজনীতি, অর্থনীতি ও বিশ্ব সংবাদ",
    template: "%s | FactNews Bangladesh",
  },
  description:
    "FactNews Bangladesh (ফ্যাক্টনিউজ বাংলাদেশ) — সত্য প্রকাশে একধাপ এগিয়ে। One step ahead in revealing the truth. Independent bilingual digital newspaper for verified national, political, economic, sports, tech, and international news.",
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  alternates: {
    canonical: "/",
    languages: {
      "bn-BD": "/",
      "en-US": "/",
    },
  },
  keywords: [
    "FactNews Bangladesh",
    "ফ্যাক্টনিউজ বাংলাদেশ",
    "সত্য প্রকাশে একধাপ এগিয়ে",
    "Bangladesh news",
    "Bangla news",
    "বাংলাদেশের খবর",
    "আজকের খবর",
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
    title: "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে | জাতীয় ও আন্তর্জাতিক সংবাদ",
    description:
      "সত্য প্রকাশে একধাপ এগিয়ে • One step ahead in revealing the truth. Independent bilingual broadsheet delivering verified reporting from Bangladesh.",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে",
    description:
      "One step ahead in revealing the truth. Verified bilingual breaking news, politics, economy, sports & world coverage from Bangladesh.",
    images: [`${SITE_URL}/og-image.png`],
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
        slogan: "সত্য প্রকাশে একধাপ এগিয়ে • One step ahead in revealing the truth.",
        email: "contact@factnewsbangladesh.bond",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
        publishingPrinciples: `${SITE_URL}/about`,
        correctionsPolicy: `${SITE_URL}/contact`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "FactNews Bangladesh",
        description: "সত্য প্রকাশে একধাপ এগিয়ে • One step ahead in revealing the truth.",
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
