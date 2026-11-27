import { getSupabaseConfig, type PagesContext } from "./lib/cf-edge";

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
  const sb = getSupabaseConfig(context.env);
  const restUrl = (url || sb?.url || "").replace(/\/$/, "");
  const authKey = anonKey || sb?.serviceKey || "";

  const articles: Array<{ slug: string; published_at: string }> = [];
  if (restUrl && authKey) {
    const PAGE = 1000;
    for (let offset = 0; offset < 5000; offset += PAGE) {
      const res = await fetch(
        `${restUrl}/rest/v1/articles?select=slug,published_at&status=eq.published&order=published_at.desc&limit=${PAGE}&offset=${offset}`,
        { headers: { apikey: authKey, Authorization: `Bearer ${authKey}` } },
      );
      if (!res.ok) break;
      const chunk = (await res.json()) as Array<{ slug: string; published_at: string }>;
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      articles.push(...chunk);
      if (chunk.length < PAGE) break;
    }
  }

  const staticPaths = ["/", "/about", "/privacy", "/terms", "/contact"];
  const staticXml = staticPaths
    .map(
      (p) => `  <url>
    <loc>${escapeXml(baseUrl + p)}</loc>
    <changefreq>${p === "/" ? "hourly" : "monthly"}</changefreq>
    <priority>${p === "/" ? "1.0" : "0.5"}</priority>
  </url>`,
    )
    .join("\n");

  const articleXml = articles
    .map(
      (a) => `  <url>
    <loc>${escapeXml(`${baseUrl}/news/${a.slug}`)}</loc>
    <lastmod>${escapeXml(new Date(a.published_at).toISOString())}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${articleXml}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=120",
    },
  });
}
