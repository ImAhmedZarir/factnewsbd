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

  let articles: Array<{ slug: string; published_at: string }> = [];
  if (url && anonKey) {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/articles?select=slug,published_at&status=eq.published&order=published_at.desc&limit=5000`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (res.ok) {
      articles = (await res.json()) as typeof articles;
    }
  } else {
    const sb = getSupabaseConfig(context.env);
    if (sb) {
      const res = await fetch(
        `${sb.url}/rest/v1/articles?select=slug,published_at&status=eq.published&order=published_at.desc&limit=1000`,
        { headers: { apikey: sb.serviceKey, Authorization: `Bearer ${sb.serviceKey}` } },
      );
      if (res.ok) articles = (await res.json()) as typeof articles;
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
