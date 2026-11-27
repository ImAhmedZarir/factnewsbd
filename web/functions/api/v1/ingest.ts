import {
  buildCdnImageTokenEdge,
  getSupabaseConfig,
  isSafeExternalUrl,
  jsonResponse,
  sha256Hex,
  verifyPatBearerEdge,
  type PagesContext,
} from "../../lib/cf-edge";

const ALLOWED_CATEGORIES = new Set([
  "national",
  "politics",
  "economy",
  "international",
  "tech",
  "sports",
  "entertainment",
  "regional",
]);
const ALLOWED_VERIFICATION = new Set([
  "verified",
  "corroborated",
  "single_source",
  "fact_check",
  "disputed",
]);

interface IncomingArticle {
  id?: string;
  slug?: string;
  lang?: string;
  category?: string;
  region?: string;
  title_bn?: string;
  title_en?: string;
  summary_bn?: string;
  summary_en?: string;
  body_bn?: string;
  body_en?: string;
  verification_status?: string;
  confidence_score?: number;
  source_count?: number;
  primary_source?: string;
  primary_source_bn?: string;
  source_url?: string;
  image_url?: string | null;
  image_alt?: string;
  published_at?: string;
  is_breaking?: boolean;
  sources?: Array<{
    sourceId?: string;
    nameEn?: string;
    nameBn?: string;
    domain?: string;
    url?: string;
    tier?: number;
    headline?: string;
  }>;
}

export async function onRequestGet(context: PagesContext) {
  const auth = await verifyPatBearerEdge(context.request.headers.get("authorization"), context.env);
  if (!auth.ok) {
    return jsonResponse({ ok: true, service: "FactNews Bangladesh Ingest API" }, 200, true);
  }

  const sb = getSupabaseConfig(context.env);
  if (!sb) {
    return jsonResponse({ ok: true, mode: "unconfigured", recent_ingests: [] }, 200, true);
  }

  const res = await fetch(
    `${sb.url}/rest/v1/ingest_logs?select=*&order=created_at.desc&limit=10`,
    {
      headers: {
        apikey: sb.serviceKey,
        Authorization: `Bearer ${sb.serviceKey}`,
      },
    },
  );
  const logs = res.ok ? await res.json() : [];
  return jsonResponse({ ok: true, mode: "supabase", recent_ingests: logs }, 200, true);
}

export async function onRequestPost(context: PagesContext) {
  const auth = await verifyPatBearerEdge(context.request.headers.get("authorization"), context.env);
  if (!auth.ok || !auth.pat) {
    return jsonResponse({ error: auth.reason || "Unauthorized" }, 401, true);
  }

  const sb = getSupabaseConfig(context.env);
  if (!sb) {
    return jsonResponse({ error: "Supabase service credentials not configured" }, 500, true);
  }

  let body: {
    articles?: IncomingArticle[];
    source_report?: { working_sources?: number };
    trigger_rebuild?: boolean;
  };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400, true);
  }

  const rawArticles = Array.isArray(body.articles) ? body.articles.slice(0, 60) : [];
  if (rawArticles.length === 0) {
    return jsonResponse({ error: "Payload must include non-empty articles[]" }, 400, true);
  }

  const rows: Record<string, unknown>[] = [];
  const sourceRows: Record<string, unknown>[] = [];

  for (let idx = 0; idx < rawArticles.length; idx += 1) {
    const item = rawArticles[idx]!;
    const titleBn = String(item.title_bn || item.title_en || "").trim().slice(0, 320);
    const titleEn = String(item.title_en || item.title_bn || "").trim().slice(0, 320);
    if (!titleBn && !titleEn) continue;

    const rawSourceUrl = String(item.source_url || "https://factnewsbangladesh.bond").trim();
    const sourceUrl = isSafeExternalUrl(rawSourceUrl)
      ? rawSourceUrl
      : "https://factnewsbangladesh.bond";
    const slugHash = (await sha256Hex(sourceUrl)).slice(0, 8);
    const safeCustomSlug = item.slug
      ? item.slug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80)
      : "";
    const slug =
      safeCustomSlug ||
      `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "story"}-${slugHash}`;

    const articleId = `art_${slugHash}_${idx}`;
    const category = item.category && ALLOWED_CATEGORIES.has(item.category) ? item.category : "national";
    const verificationStatus =
      item.verification_status && ALLOWED_VERIFICATION.has(item.verification_status)
        ? item.verification_status
        : "single_source";

    const summaryBn = String(item.summary_bn || titleBn).trim().slice(0, 800);
    const summaryEn = String(item.summary_en || titleEn).trim().slice(0, 800);
    const imageCdnToken = await buildCdnImageTokenEdge(
      item.image_url,
      context.env.CDN_SIGNING_SECRET,
    );

    rows.push({
      id: articleId,
      slug,
      lang: item.lang === "en" ? "en" : "bn",
      category,
      region: String(item.region || "national").slice(0, 40),
      title_bn: titleBn,
      title_en: titleEn,
      summary_bn: summaryBn,
      summary_en: summaryEn,
      body_bn: String(item.body_bn || summaryBn).slice(0, 40000),
      body_en: String(item.body_en || summaryEn).slice(0, 40000),
      verification_status: verificationStatus,
      confidence_score: Math.min(100, Math.max(0, Number(item.confidence_score ?? 65))),
      source_count: Math.max(1, Number(item.source_count ?? item.sources?.length ?? 1)),
      primary_source: String(item.primary_source || "Newsroom Dispatch").slice(0, 120),
      primary_source_bn: String(item.primary_source_bn || item.primary_source || "নিউজরুম").slice(0, 120),
      source_url: sourceUrl,
      image_cdn_token: imageCdnToken,
      image_alt_bn: String(item.image_alt || titleBn).slice(0, 240),
      image_alt_en: String(item.image_alt || titleEn).slice(0, 240),
      seo_title_bn: titleBn.slice(0, 60),
      seo_title_en: titleEn.slice(0, 60),
      seo_desc_bn: summaryBn.slice(0, 155),
      seo_desc_en: summaryEn.slice(0, 155),
      status: "published",
      is_breaking: Boolean(item.is_breaking),
      published_at: item.published_at || new Date().toISOString(),
    });

    if (Array.isArray(item.sources)) {
      const seenDomains = new Set<string>();
      for (const s of item.sources.slice(0, 10)) {
        if (!s.domain || !s.url || !isSafeExternalUrl(s.url) || seenDomains.has(s.domain)) {
          continue;
        }
        seenDomains.add(s.domain);
        sourceRows.push({
          article_id: articleId,
          source_id: s.sourceId || null,
          source_name_en: String(s.nameEn || item.primary_source || s.domain).slice(0, 120),
          source_name_bn: String(s.nameBn || item.primary_source_bn || s.domain).slice(0, 120),
          source_domain: String(s.domain).slice(0, 120),
          original_url: s.url,
          original_headline: String(s.headline || titleBn).slice(0, 320),
          tier: Math.min(4, Math.max(1, Number(s.tier || 2))),
        });
      }
    }
  }

  if (rows.length === 0) {
    return jsonResponse({ error: "No valid articles in payload" }, 400, true);
  }

  const upsertRes = await fetch(`${sb.url}/rest/v1/articles?on_conflict=slug`, {
    method: "POST",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!upsertRes.ok) {
    return jsonResponse({ error: "Database ingestion failed" }, 502, true);
  }

  if (sourceRows.length > 0) {
    await fetch(`${sb.url}/rest/v1/article_sources?on_conflict=article_id,source_domain`, {
      method: "POST",
      headers: {
        apikey: sb.serviceKey,
        Authorization: `Bearer ${sb.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(sourceRows),
    }).catch(() => undefined);
  }

  await fetch(`${sb.url}/rest/v1/ingest_logs`, {
    method: "POST",
    headers: {
      apikey: sb.serviceKey,
      Authorization: `Bearer ${sb.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      pat_id: auth.pat.id.startsWith("pat_") ? null : auth.pat.id,
      pat_label: auth.pat.label,
      articles_upserted: rows.length,
      sources_scanned: Number(body.source_report?.working_sources ?? 0),
      revalidated_paths: rows.slice(0, 15).map((r) => `/news/${String(r.slug)}`),
    }),
  }).catch(() => undefined);

  let rebuildTriggered = false;
  if (context.env.CLOUDFLARE_DEPLOY_HOOK_URL && body.trigger_rebuild !== false) {
    rebuildTriggered = true;
    context.waitUntil(
      fetch(context.env.CLOUDFLARE_DEPLOY_HOOK_URL, { method: "POST" }).catch(() => undefined),
    );
  }

  return jsonResponse(
    {
      ok: true,
      upserted: rows.length,
      backend: "supabase",
      rebuild_triggered: rebuildTriggered,
      pat_label: auth.pat.label,
    },
    200,
    true,
  );
}
