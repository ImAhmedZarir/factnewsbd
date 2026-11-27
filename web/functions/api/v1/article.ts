import { getSupabaseConfig, type PagesContext } from "../../lib/cf-edge";

const SLUG_RE = /^[a-z0-9-]{3,120}$/i;

function mapEdgeRow(row: Record<string, unknown>, cdnBase: string, includeBody: boolean) {
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
    mapped.body_bn = row.body_bn ? String(row.body_bn) : String(row.summary_bn);
    mapped.body_en = row.body_en ? String(row.body_en) : String(row.summary_en);
  }
  return mapped;
}

export async function onRequestGet(context: PagesContext) {
  const reqUrl = new URL(context.request.url);
  const slug = (reqUrl.searchParams.get("slug") || "").trim();
  if (!SLUG_RE.test(slug)) {
    return new Response(JSON.stringify({ article: null, latest: [] }), {
      status: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const edgeCache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const canonicalUrl = new URL(reqUrl.origin + reqUrl.pathname);
  canonicalUrl.searchParams.set("slug", slug);
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

  if (!pubUrl || !readKey) {
    return new Response(JSON.stringify({ article: null, latest: [] }), {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const latestCols =
    "id,slug,lang,category,region,title_bn,title_en,summary_bn,summary_en,verification_status,confidence_score,source_count,primary_source,primary_source_bn,source_url,image_cdn_token,image_alt_bn,image_alt_en,published_at,is_breaking,article_sources(*)";
  const hdrs = { apikey: readKey, Authorization: `Bearer ${readKey}` };

  const [artRes, latestRes] = await Promise.all([
    fetch(
      `${pubUrl}/rest/v1/articles?select=*,article_sources(*)&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
      { headers: hdrs },
    ),
    fetch(
      `${pubUrl}/rest/v1/articles?select=${latestCols}&status=eq.published&order=published_at.desc&limit=12`,
      { headers: hdrs },
    ),
  ]);

  const artRows = artRes.ok ? ((await artRes.json()) as Record<string, unknown>[]) : [];
  const latestRows = latestRes.ok ? ((await latestRes.json()) as Record<string, unknown>[]) : [];
  const art = artRows[0] ? mapEdgeRow(artRows[0], cdnBase, true) : null;
  const latest = (Array.isArray(latestRows) ? latestRows : [])
    .filter((r) => r.slug !== slug)
    .map((r) => mapEdgeRow(r, cdnBase, false));

  const response = new Response(JSON.stringify({ article: art, latest }), {
    status: art ? 200 : 404,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": art ? "public, max-age=300, s-maxage=300" : "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
  if (edgeCache && art) {
    context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  }
  return response;
}
