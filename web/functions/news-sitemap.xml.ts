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

  let articles: Array<{ slug: string; title_bn: string; lang: string; published_at: string }> = [];
  if (url && anonKey) {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/articles?select=slug,title_bn,lang,published_at&status=eq.published&order=published_at.desc&limit=1000`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (res.ok) {
      articles = (await res.json()) as typeof articles;
    }
  }

  const urlNodes = articles
    .map(
      (a) => `  <url>
    <loc>${escapeXml(`${baseUrl}/news/${a.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>FactNews Bangladesh</news:name>
        <news:language>${a.lang === "en" ? "en" : "bn"}</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(new Date(a.published_at).toISOString())}</news:publication_date>
      <news:title>${escapeXml(a.title_bn)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlNodes}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=120",
    },
  });
}
