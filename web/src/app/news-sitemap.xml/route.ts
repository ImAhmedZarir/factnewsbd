import { escapeXml } from "@/lib/security";
import { getArticles } from "@/lib/store";

export const dynamic = "force-static";

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
    /\/$/,
    "",
  );
  const articles = await getArticles(50);

  const urlNodes = articles
    .map((art) => {
      const loc = escapeXml(`${baseUrl}/news/${art.slug}`);
      const pubDate = new Date(art.published_at).toISOString();
      const title = escapeXml(art.title_bn);
      const lang = art.lang === "en" ? "en" : "bn";
      return `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>FactNews Bangladesh</news:name>
        <news:language>${lang}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlNodes}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
