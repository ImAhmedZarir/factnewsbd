import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleReader } from "@/components/article-reader";
import { getArticleBySlug, getArticles } from "@/lib/store";

export const revalidate = 300;

export async function generateStaticParams() {
  const articles = await getArticles(52);
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
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.published_at,
      images: article.image_cdn_url
        ? [{ url: article.image_cdn_url, width: 1200, height: 675, alt: title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, all] = await Promise.all([getArticleBySlug(slug), getArticles(24)]);
  if (!article) notFound();

  const related = all
    .filter((a) => a.slug !== article.slug && a.category === article.category)
    .slice(0, 3);
  const latest = all.filter((a) => a.slug !== article.slug).slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title_bn,
    alternativeHeadline: article.title_en,
    datePublished: article.published_at,
    description: article.summary_bn,
    articleBody: article.body_bn || article.summary_bn,
    image: article.image_cdn_url ? [article.image_cdn_url] : undefined,
    publisher: {
      "@type": "Organization",
      name: "FactNews Bangladesh",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleReader article={article} related={related} latest={latest} />
    </>
  );
}
