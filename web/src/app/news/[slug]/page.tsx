import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleReader } from "@/components/article-reader";
import { safeJsonLd } from "@/lib/security";
import { getArticleBySlug, getArticles, getFeedArticles } from "@/lib/store";

export const dynamic = "force-static";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
  /\/$/,
  "",
);

export async function generateStaticParams() {
  const articles = await getArticles(2500);
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article Not Found" };

  const title = article.title_bn;
  const description = article.summary_bn.slice(0, 155);
  const canonicalUrl = `${SITE_URL}/news/${article.slug}`;
  const ogImage = article.image_cdn_url || `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    keywords: [
      article.category,
      article.primary_source,
      "FactNews Bangladesh",
      "Bangladesh news",
    ],
    authors: [{ name: article.primary_source_bn || "FactNews Bangladesh Desk" }],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "FactNews Bangladesh",
      type: "article",
      publishedTime: article.published_at,
      modifiedTime: article.published_at,
      section: article.category,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 675,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, all] = await Promise.all([getArticleBySlug(slug), getFeedArticles(40)]);
  if (!article) notFound();

  const related = all
    .filter((a) => a.slug !== article.slug && a.category === article.category)
    .slice(0, 3);
  const latest = all.filter((a) => a.slug !== article.slug).slice(0, 6);

  const canonicalUrl = `${SITE_URL}/news/${article.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": canonicalUrl,
        },
        url: canonicalUrl,
        headline: article.title_bn.slice(0, 110),
        alternativeHeadline: article.title_en,
        datePublished: article.published_at,
        dateModified: article.published_at,
        description: article.summary_bn,
        articleBody: article.body_bn || article.summary_bn,
        articleSection: article.category,
        inLanguage: article.lang === "en" ? "en-US" : "bn-BD",
        isAccessibleForFree: true,
        image: article.image_cdn_url ? [article.image_cdn_url] : undefined,
        author: {
          "@type": "Organization",
          name: `FactNews Bangladesh (${article.primary_source})`,
        },
        publisher: {
          "@type": "NewsMediaOrganization",
          name: "FactNews Bangladesh",
          url: SITE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          {
            "@type": "ListItem",
            position: 2,
            name: article.category,
            item: `${SITE_URL}/?category=${article.category}`,
          },
          { "@type": "ListItem", position: 3, name: article.title_bn, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <ArticleReader article={article} related={related} latest={latest} />
    </>
  );
}
