import type { Metadata } from "next";
import { NewsFrontpage } from "@/components/news-frontpage";
import { safeJsonLd } from "@/lib/security";
import { getArticles } from "@/lib/store";

export const dynamic = "force-static";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
  /\/$/,
  "",
);

export const metadata: Metadata = {
  title: "FactNews Bangladesh • সর্বশেষ বাংলা ও ইংরেজি সংবাদ",
  description:
    "বাংলাদেশ, রাজনীতি, অর্থনীতি, বিশ্ব, প্রযুক্তি ও খেলার সর্বশেষ যাচাইকৃত সংবাদ — FactNews Bangladesh।",
  alternates: {
    canonical: `${SITE_URL}/`,
  },
};

export default async function HomePage() {
  const articles = await getArticles(60);

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
