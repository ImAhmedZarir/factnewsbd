import { type PagesContext } from "./lib/cf-edge";

function escapeXml(raw: string): string {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function onRequestGet(context: PagesContext) {
  const baseUrl = (context.env.NEXT_PUBLIC_SITE_URL || "https://factnewsbangladesh.bond").replace(
    /\/$/,
    "",
  );
  const url = context.env.NEXT_PUBLIC_SUPABASE_URL || context.env.SUPABASE_URL;
  const anonKey = context.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let articles: Array<{
    slug: string;
    title_bn: string;
    summary_bn: string;
    category: string;
    image_cdn_token: string | null;
    published_at: string;
  }> = [];
  if (url && anonKey) {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/articles?select=slug,title_bn,summary_bn,category,image_cdn_token,published_at&status=eq.published&order=published_at.desc&limit=100`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (res.ok) {
      articles = (await res.json()) as typeof articles;
    }
  }

  const cdnBase = "https://cdn.factnewsbangladesh.bond";
  const items = articles
    .map((a) => {
      const link = `${baseUrl}/news/${a.slug}`;
      const enclosure = a.image_cdn_token
        ? `<enclosure url="${escapeXml(`${cdnBase}/i/${a.image_cdn_token}.webp`)}" type="image/webp" />`
        : "";
      return `    <item>
      <title>${escapeXml(a.title_bn)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(new Date(a.published_at).toUTCString())}</pubDate>
      <category>${escapeXml(a.category)}</category>
      <description>${escapeXml(a.summary_bn)}</description>
      ${enclosure}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>FactNews Bangladesh • ফ্যাক্টনিউজ বাংলাদেশ</title>
    <link>${escapeXml(baseUrl)}/</link>
    <description>সত্য প্রকাশে একধাপ এগিয়ে • One step ahead in revealing the truth. Independent bilingual digital newspaper delivering verified news across Bangladesh.</description>
    <language>bn-bd</language>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=120",
    },
  });
}
