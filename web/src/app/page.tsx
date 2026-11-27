import type { Metadata } from "next";
import { NewsFrontpage } from "@/components/news-frontpage";
import { safeJsonLd } from "@/lib/security";
import { getFeedArticles } from "@/lib/store";

export const dynamic = "force-static";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
  /\/$/,
  "",
);

export const metadata: Metadata = {
  title: {
    absolute:
      "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে | ফ্যাক্টনিউজ বাংলাদেশ • সর্বশেষ সংবাদ",
  },
  description:
    "সত্য প্রকাশে একধাপ এগিয়ে — One step ahead in revealing the truth. বাংলাদেশ, রাজনীতি, অর্থনীতি, বিশ্ব, প্রযুক্তি ও খেলার যাচাইকৃত বাংলা ও ইংরেজি সংবাদ।",
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  openGraph: {
    title: "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে | ফ্যাক্টনিউজ বাংলাদেশ",
    description:
      "সত্য প্রকাশে একধাপ এগিয়ে • One step ahead in revealing the truth. Verified national & international news from Bangladesh.",
    url: `${SITE_URL}/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "FactNews Bangladesh — সত্য প্রকাশে একধাপ এগিয়ে",
      },
    ],
  },
};

export default async function HomePage() {
  const articles = await getFeedArticles(60);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "FactNews Bangladesh — Frontpage Edition",
    url: `${SITE_URL}/`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.slice(0, 12).map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/news/${a.slug}`,
        name: a.title_bn,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      <NewsFrontpage articles={articles} />
    </>
  );
}
