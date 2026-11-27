import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const WEB_DIR = process.cwd();
const FEED_DIR = path.join(WEB_DIR, "public", "feed");
const SEED_FILE = path.resolve(WEB_DIR, "..", "data", "scraped_seed.json");
const INITIAL_HOME_COUNT = 60;
const CHUNK_SIZE = 80;
const PAGE_SIZE = 1000;
const MAX_TOTAL = 2500;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(WEB_DIR, ".env.local"));
loadEnvFile(path.join(WEB_DIR, ".env"));

const CDN_BASE = (
  process.env.NEXT_PUBLIC_CDN_BASE_URL || "https://cdn.factnewsbangladesh.bond"
).replace(/\/$/, "");
const CDN_SECRET =
  process.env.CDN_SIGNING_SECRET || "bd-factnews-local-cdn-signing-secret-change-me";

function buildLocalCdnUrl(rawUrl) {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return null;
  const payload = Buffer.from(JSON.stringify({ u: rawUrl }), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", CDN_SECRET).update(payload).digest("base64url").slice(0, 22);
  return `${CDN_BASE}/i/${payload}.${sig}.webp`;
}

function mapCardRow(row) {
  const token = row.image_cdn_token || null;
  const imageCdnUrl = token ? `${CDN_BASE}/i/${token}.webp` : buildLocalCdnUrl(row.image_url);
  const rawSources = Array.isArray(row.article_sources)
    ? row.article_sources.map((s) => ({
        sourceId: String(s.source_id || s.source_domain),
        nameEn: String(s.source_name_en),
        nameBn: String(s.source_name_bn),
        domain: String(s.source_domain),
        url: String(s.original_url),
        tier: Number(s.tier || 2),
        headline: String(s.original_headline),
      }))
    : Array.isArray(row.sources)
      ? row.sources
      : [];

  return {
    id: String(row.id),
    slug: String(row.slug),
    lang: row.lang === "en" ? "en" : "bn",
    category: row.category || "national",
    region: String(row.region || "national"),
    title_bn: String(row.title_bn),
    title_en: String(row.title_en || row.title_bn),
    summary_bn: String(row.summary_bn || ""),
    summary_en: String(row.summary_en || row.summary_bn || ""),
    verification_status: row.verification_status || "single_source",
    confidence_score: Number(row.confidence_score || 75),
    source_count: Number(row.source_count || 1),
    primary_source: String(row.primary_source || ""),
    primary_source_bn: String(row.primary_source_bn || row.primary_source || ""),
    source_url: String(row.source_url || ""),
    image_url: null,
    image_cdn_url: imageCdnUrl,
    image_alt: String(row.image_alt_bn || row.image_alt_en || row.image_alt || row.title_bn),
    published_at: String(row.published_at),
    is_breaking: Boolean(row.is_breaking),
    sources: rawSources,
  };
}

async function fetchAllLightweightCards() {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (sbUrl && anonKey) {
    const sb = createClient(sbUrl, anonKey, { auth: { persistSession: false } });
    const rows = [];
    const selectCols =
      "id,slug,lang,category,region,title_bn,title_en,summary_bn,summary_en,verification_status,confidence_score,source_count,primary_source,primary_source_bn,source_url,image_cdn_token,image_alt_bn,image_alt_en,published_at,is_breaking,article_sources(*)";
    for (let offset = 0; offset < MAX_TOTAL; offset += PAGE_SIZE) {
      const end = Math.min(offset + PAGE_SIZE - 1, MAX_TOTAL - 1);
      const { data, error } = await sb
        .from("articles")
        .select(selectCols)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(offset, end);
      if (error || !Array.isArray(data) || data.length === 0) break;
      for (const r of data) rows.push(mapCardRow(r));
      if (data.length < PAGE_SIZE) break;
    }
    if (rows.length > 0) {
      return rows.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
    }
  }

  if (fs.existsSync(SEED_FILE)) {
    const raw = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    return raw
      .map(mapCardRow)
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  }
  return [];
}

async function main() {
  fs.rmSync(FEED_DIR, { recursive: true, force: true });
  fs.mkdirSync(FEED_DIR, { recursive: true });

  const allCards = await fetchAllLightweightCards();
  const rest = allCards.slice(INITIAL_HOME_COUNT);
  const chunkPaths = [];

  for (let i = 0; i < rest.length; i += CHUNK_SIZE) {
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const fileName = `chunk-${chunkNum}.json`;
    const slice = rest.slice(i, i + CHUNK_SIZE);
    fs.writeFileSync(path.join(FEED_DIR, fileName), JSON.stringify(slice), "utf8");
    chunkPaths.push(`/feed/${fileName}`);
  }

  const manifest = {
    total: allCards.length,
    initialCount: Math.min(INITIAL_HOME_COUNT, allCards.length),
    chunkSize: CHUNK_SIZE,
    latestPublishedAt: allCards[0]?.published_at || new Date().toISOString(),
    chunks: chunkPaths,
  };
  fs.writeFileSync(path.join(FEED_DIR, "manifest.json"), JSON.stringify(manifest), "utf8");
  console.log(
    `[feed-chunks] Built ${chunkPaths.length} static JSON chunks covering ${allCards.length} lightweight cards (initial homepage=${manifest.initialCount}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
