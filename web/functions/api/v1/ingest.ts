import {
  buildCdnImageTokenEdge,
  getSupabaseConfig,
  jsonResponse,
  sha256Hex,
  verifyPatBearerEdge,
  type PagesContext,
} from "../../lib/cf-edge";

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
    return jsonResponse({ ok: true, service: "FactNews Bangladesh Ingest API" });
  }

  const sb = getSupabaseConfig(context.env);
  if (!sb) {
    return jsonResponse({ ok: true, mode: "unconfigured", recent_ingests: [] });
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
  return jsonResponse({ ok: true, mode: "supabase", recent_ingests: logs });
}

export async function onRequestPost(context: PagesContext) {
  const auth = await verifyPatBearerEdge(context.request.headers.get("authorization"), context.env);
  if (!auth.ok || !auth.pat) {
    return jsonResponse({ error: auth.reason || "Unauthorized" }, 401);
  }

  const sb = getSupabaseConfig(context.env);
  if (!sb) {
    return jsonResponse({ error: "Supabase service credentials not configured" }, 500);
  }

  let body: {
    articles?: IncomingArticle[];
    source_report?: { working_sources?: number };
    trigger_rebuild?: boolean;
  };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const rawArticles = Array.isArray(body.articles) ? body.articles.slice(0, 60) : [];
  if (rawArticles.length === 0) {
    return jsonResponse({ error: "Payload must include non-empty articles[]" }, 400);
  }

  const rows: Record<string, unknown>[] = [];
  const sourceRows: Record<string, unknown>[] = [];

  for (let idx = 0; idx < rawArticles.length; idx += 1) {
    const item = rawArticles[idx]!;
    const titleBn = String(item.title_bn || item.title_en || "").trim();
    const titleEn = String(item.title_en || item.title_bn || "").trim();
    const sourceUrl = String(item.source_url || "https://factnewsbangladesh.bond");
    const slugHash = (await sha256Hex(sourceUrl)).slice(0, 8);
    const slug =
      item.slug?.trim() ||
      `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "story"}-${slugHash}`;
    const articleId = item.id || `art_${slugHash}_${idx}`;
    const summaryBn = String(item.summary_bn || titleBn);
    const summaryEn = String(item.summary_en || titleEn);
    const imageCdnToken = await buildCdnImageTokenEdge(
      item.image_url,
      context.env.CDN_SIGNING_SECRET,
    );

    rows.push({
      id: articleId,
      slug,
      lang: item.lang === "en" ? "en" : "bn",
      category: item.category || "national",
      region: item.region || "national",
      title_bn: titleBn,
      title_en: titleEn,
      summary_bn: summaryBn,
      summary_en: summaryEn,
      body_bn: item.body_bn || summaryBn,
      body_en: item.body_en || summaryEn,
      verification_status: item.verification_status || "single_source",
      confidence_score: Math.min(100, Math.max(0, Number(item.confidence_score ?? 65))),
      source_count: Math.max(1, Number(item.source_count ?? item.sources?.length ?? 1)),
      primary_source: String(item.primary_source || "Newsroom Dispatch"),
      primary_source_bn: String(item.primary_source_bn || item.primary_source || "নিউজরুম"),
      source_url: sourceUrl,
      image_cdn_token: imageCdnToken,
      image_alt_bn: String(item.image_alt || titleBn),
      image_alt_en: String(item.image_alt || titleEn),
      seo_title_bn: titleBn.slice(0, 60),
      seo_title_en: titleEn.slice(0, 60),
      seo_desc_bn: summaryBn.slice(0, 155),
      seo_desc_en: summaryEn.slice(0, 155),
      status: "published",
      is_breaking: Boolean(item.is_breaking),
      published_at: item.published_at || new Date().toISOString(),
    });

    if (Array.isArray(item.sources)) {
      for (const s of item.sources) {
        if (!s.domain || !s.url) continue;
        sourceRows.push({
          article_id: articleId,
          source_id: s.sourceId || null,
          source_name_en: String(s.nameEn || item.primary_source || s.domain),
          source_name_bn: String(s.nameBn || item.primary_source_bn || s.domain),
          source_domain: String(s.domain),
          original_url: String(s.url),
          original_headline: String(s.headline || titleBn),
          tier: Number(s.tier || 2),
        });
      }
    }
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
    const errText = await upsertRes.text();
    return jsonResponse({ error: `Supabase upsert failed: ${errText}` }, 502);
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
  if (
    context.env.CLOUDFLARE_DEPLOY_HOOK_URL &&
    body.trigger_rebuild !== false
  ) {
    rebuildTriggered = true;
    context.waitUntil(
      fetch(context.env.CLOUDFLARE_DEPLOY_HOOK_URL, { method: "POST" }).catch(() => undefined),
    );
  }

  return jsonResponse({
    ok: true,
    upserted: rows.length,
    backend: "supabase",
    rebuild_triggered: rebuildTriggered,
    pat_label: auth.pat.label,
  });
}
