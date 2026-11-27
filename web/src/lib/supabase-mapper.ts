import type { Article } from "./types";

export function mapSupabaseArticleRow(
  row: Record<string, unknown>,
  cdnBaseOverride?: string,
): Article {
  const token = row.image_cdn_token as string | null;
  const cdnBase = (
    cdnBaseOverride ??
    process.env.NEXT_PUBLIC_CDN_BASE_URL ??
    "https://cdn.factnewsbangladesh.bond"
  ).replace(/\/$/, "");

  const imageCdnUrl = token
    ? cdnBase
      ? `${cdnBase}/i/${token}.webp`
      : `/api/cdn/image?t=${encodeURIComponent(token)}`
    : null;

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

  return {
    id: String(row.id),
    slug: String(row.slug),
    lang: (row.lang as "bn" | "en") || "bn",
    category: (row.category as Article["category"]) || "national",
    region: String(row.region || "national"),
    title_bn: String(row.title_bn),
    title_en: String(row.title_en),
    summary_bn: String(row.summary_bn),
    summary_en: String(row.summary_en),
    body_bn: row.body_bn ? String(row.body_bn) : String(row.summary_bn),
    body_en: row.body_en ? String(row.body_en) : String(row.summary_en),
    verification_status: row.verification_status as Article["verification_status"],
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
}
