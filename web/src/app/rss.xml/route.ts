import { escapeXml } from "@/lib/security";
import { getArticles } from "@/lib/store";

export const dynamic = "force-static";

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
    /\/$/,
    "",
  );
  const articles = await getArticles(50);

  const items = articles
    .map((art) => {
      const link = `${baseUrl}/news/${art.slug}`;
      const pubDate = new Date(art.published_at).toUTCString();
      const title = escapeXml(art.title_bn);
      const desc = escapeXml(art.summary_bn);
      const cat = escapeXml(art.category);
      const mediaTag = art.image_cdn_url
        ? `<enclosure url="${escapeXml(art.image_cdn_url)}" type="image/webp" />`
        : "";
      return `    <item>
      <title>${title}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${cat}</category>
      <description>${desc}</description>
      ${mediaTag}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>FactNews Bangladesh • ফ্যাক্টনিউজ বাংলাদেশ</title>
    <link>${escapeXml(baseUrl)}/</link>
    <description>Independent bilingual digital newspaper delivering verified news across Bangladesh.</description>
    <language>bn-bd</language>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
