import { getSupabaseConfig, type PagesContext } from "../../lib/cf-edge";

function mapEdgeArticleRow(row: Record<string, unknown>, cdnBase: string, includeBody: boolean) {
  const token = row.image_cdn_token as string | null;
  const imageCdnUrl = token ? `${cdnBase}/i/${token}.webp` : null;
  const linkedSources = Array.isArray(row.article_sources)
    ? (row.article_sources as Record<string, unknown>[]).map((s) => ({
        sourceId: String(s.source_id || s.source_domain),
        nameEn: String(s.source_name_en),
        nameBn: String(s.source_name_bn),
        domain: String(s.source_domain),
        url: String(s.original_url),
        tier: Number(s.tier || 2),
        headline: String(s.original_headline),
      }))
    : [];

  const mapped: Record<string, unknown> = {
    id: String(row.id),
    slug: String(row.slug),
    lang: row.lang === "en" ? "en" : "bn",
    category: row.category || "national",
    region: String(row.region || "national"),
    title_bn: String(row.title_bn),
    title_en: String(row.title_en),
    summary_bn: String(row.summary_bn),
    summary_en: String(row.summary_en),
    verification_status: row.verification_status || "single_source",
    confidence_score: Number(row.confidence_score || 75),
    source_count: Number(row.source_count || 1),
    primary_source: String(row.primary_source),
    primary_source_bn: String(row.primary_source_bn),
    source_url: String(row.source_url),
    image_url: null,
    image_cdn_url: imageCdnUrl,
    image_alt: String(row.image_alt_bn || row.image_alt_en || row.title_bn),
    published_at: String(row.published_at),
    is_breaking: Boolean(row.is_breaking),
    sources: linkedSources,
  };

  if (includeBody) {
    if (typeof row.body_bn === "string" && row.body_bn.trim()) mapped.body_bn = row.body_bn;
    if (typeof row.body_en === "string" && row.body_en.trim()) mapped.body_en = row.body_en;
  }
  return mapped;
}

export async function onRequestGet(context: PagesContext) {
  const reqUrl = new URL(context.request.url);
  const afterRaw = reqUrl.searchParams.get("after") || "";
  const afterMs = Date.parse(afterRaw);
  if (!afterRaw || Number.isNaN(afterMs)) {
    return new Response(JSON.stringify({ articles: [] }), {
      status: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const iso = new Date(afterMs).toISOString();
  const edgeCache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const canonicalUrl = new URL(reqUrl.origin + reqUrl.pathname);
  canonicalUrl.searchParams.set("after", iso);
  const cacheKey = new Request(canonicalUrl.toString(), { method: "GET" });
  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }

  const sb = getSupabaseConfig(context.env);
  const pubUrl = (context.env.NEXT_PUBLIC_SUPABASE_URL || sb?.url || "").replace(/\/$/, "");
  const readKey = context.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || sb?.serviceKey || "";
  const cdnBase = (
    (context.env as Record<string, string | undefined>).NEXT_PUBLIC_CDN_BASE_URL ||
    "https://cdn.factnewsbangladesh.bond"
  ).replace(/\/$/, "");

  let articles: Record<string, unknown>[] = [];
  if (pubUrl && readKey) {
    const selectCols =
      "id,slug,lang,category,region,title_bn,title_en,summary_bn,summary_en,verification_status,confidence_score,source_count,primary_source,primary_source_bn,source_url,image_cdn_token,image_alt_bn,image_alt_en,published_at,is_breaking,article_sources(*)";
    const res = await fetch(
      `${pubUrl}/rest/v1/articles?select=${selectCols}&status=eq.published&published_at=gt.${encodeURIComponent(iso)}&order=published_at.desc&limit=40`,
      { headers: { apikey: readKey, Authorization: `Bearer ${readKey}` } },
    );
    if (res.ok) {
      const rows = (await res.json()) as Record<string, unknown>[];
      if (Array.isArray(rows)) {
        articles = rows.map((r) => mapEdgeArticleRow(r, cdnBase, false));
      }
    }
  }

  const response = new Response(JSON.stringify({ articles }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
  if (edgeCache) {
    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  }
  return response;
}
