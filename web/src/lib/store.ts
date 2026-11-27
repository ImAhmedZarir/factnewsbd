import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildCdnImageToken, buildCdnImageUrl } from "./cdn";
import type { Article, IngestLogRecord } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");
const ARTICLES_FILE = path.join(DATA_DIR, "scraped_seed.json");
const INGEST_LOGS_FILE = path.join(DATA_DIR, "ingest_logs.json");

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const FEATURED_BILINGUAL_OVERRIDES: Record<
  string,
  {
    title_bn?: string;
    summary_bn?: string;
    body_bn?: string;
    title_en?: string;
    summary_en?: string;
    body_en?: string;
  }
> = {
  "Hotel manager stabbed to death in Old Dhaka, two others injured": {
    title_bn: "পুরান ঢাকার ওয়ারীতে হোটেলে ঢুকে ব্যবস্থাপককে কুপিয়ে হত্যা, আহত ২",
    summary_bn:
      "পুরান ঢাকার ওয়ারীর জয়কালী মন্দিরের পাশে ওসমানী ইন্টারন্যাশনাল আবাসিক হোটেলে মধ্যরাতে দুর্বৃত্তদের হামলায় ব্যবস্থাপক নাঈমুর রহমান নিহত এবং মহাব্যবস্থাপক আব্দুর রাজ্জাক ও কর্মী হাসান আহত হয়েছেন।",
    body_bn:
      "রাজধানীর ওয়ারীতে ওসমানী ইন্টারন্যাশনাল আবাসিক হোটেলে ঢুকে দুর্বৃত্তদের এলোপাতাড়ি ছুরিকাঘাতে হোটেল ব্যবস্থাপক নাঈমুর রহমান নিহত হয়েছেন। এ ঘটনায় হোটেলের মহাব্যবস্থাপক আব্দুর রাজ্জাক (৫০) ও কর্মী মো. হাসান (২৬) গুরুতর আহত হয়েছেন।\n\nপুলিশ ও হোটেল সূত্রে জানা গেছে, রাত ২টার দিকে জয়কালী মন্দিরসংলগ্ন আবাসিক হোটেলটিতে কয়েকজন দুর্বৃত্ত প্রবেশ করে কর্মীদের ওপর হামলা চালায়। নাঈমুরকে বাঁচাতে এগিয়ে এলে মহাব্যবস্থাপক ও অপর এক কর্মীকেও কুপিয়ে জখম করা হয়।\n\nআহতদের উদ্ধার করে ঢাকা মেডিকেল কলেজ হাসপাতালে ভর্তি করা হয়েছে। ওয়ারী থানা পুলিশ ঘটনাস্থল পরিদর্শন করেছে এবং প্রাথমিক তদন্তে এটি পূর্বশত্রুতা বা অভ্যন্তরীণ বিরোধ থেকে ঘটে থাকতে পারে বলে ধারণা করছে।\n\nনিহতের মরদেহ ময়নাতদন্তের জন্য ঢাকা মেডিকেল কলেজ মর্গে রাখা হয়েছে। হামলাকারীদের শনাক্ত করতে আশপাশের সিসিটিভি ফুটেজ সংগ্রহ করেছে পুলিশ।",
  },
  "বাল্যবিবাহের খবর দেওয়া কমেছে, কারণ কী": {
    title_en: "Why reporting of child marriage incidents has declined in recent months",
    summary_en:
      "Rights workers and local officials examine why fewer child marriage incidents are reaching formal helplines despite continuing rural pressure.",
  },
  "Gas fire in Inani brought under control after 31 days": {
    title_bn: "৩১ দিন পর নিয়ন্ত্রণে এলো ইনানীর গ্যাসকূপের আগুন",
    summary_bn:
      "বিশেষ প্রকৌশলী দল ও বাপেক্সের টানা প্রচেষ্টায় কক্সবাজারের ইনানী গ্যাসকূপে প্রায় এক মাস ধরে জ্বলতে থাকা আগুন অবশেষে নিয়ন্ত্রণে আনা হয়েছে।",
  },
  "জার্মানিতে বাঙালি কন্যার বিয়ে, যে কারণে জায়গা পেল বিশ্বখ্যাত ভোগে": {
    title_en: "Bengali bride's wedding in Germany featured in Vogue magazine",
    summary_en:
      "Blending traditional Bengali heritage with contemporary minimalism in Germany earned a Bangladeshi bride international recognition in Vogue.",
  },
  "9-year-old boy 'raped' by neighbour in Kushtia": {
    title_bn: "কুষ্টিয়ায় প্রতিবেশীর বিরুদ্ধে ৯ বছরের শিশুকে নির্যাতনের অভিযোগ",
    summary_bn:
      "কুষ্টিয়ায় নয় বছর বয়সী এক শিশু নির্যাতনের শিকার হওয়ার অভিযোগে পরিবার মামলা দায়ের করেছে; তদন্তে নেমেছে স্থানীয় পুলিশ।",
  },
  "কীভাবে মাঠে লবণ চাষ করা হয়": {
    title_en: "Inside coastal Bangladesh: How traditional sea salt farming works",
    summary_en:
      "A closer look at how coastal farmers in Cox's Bazar prepare fields, trap tidal water, and harvest raw salt under intense sun.",
  },
  "Five arrested in Munshiganj raid; firearms, ammunition and crude bombs recovered": {
    title_bn: "মুন্সীগঞ্জে অভিযানে আগ্নেয়াস্ত্র, গুলি ও ককটেলসহ আটক ৫",
    summary_bn:
      "মুন্সীগঞ্জে আইনশৃঙ্খলা বাহিনীর বিশেষ অভিযানে আগ্নেয়াস্ত্র, গোলাবারুদ ও বেশ কয়েকটি ককটেলসহ পাঁচজনকে আটক করা হয়েছে।",
  },
  "বোনের জন্মের সময় কষ্ট দেখে গ্রামে হাসপাতাল বানিয়েছেন মানে, চিকিৎসা পাচ্ছে আরও ৩০ গ্রাম": {
    title_en: "Inspired by sister's ordeal, villager builds clinic serving 30 rural communities",
    summary_en:
      "After witnessing maternal healthcare struggles firsthand, a local philanthropist built a community hospital now treating patients across 30 nearby villages.",
  },
};

function enrichArticle(raw: Article): Article {
  const override =
    FEATURED_BILINGUAL_OVERRIDES[raw.title_bn] ||
    FEATURED_BILINGUAL_OVERRIDES[raw.title_en];
  const cleanEnTitle = raw.title_en.replace(/^\[[^\]]+\]\s*/, "");
  const cleanBnTitle = raw.title_bn.replace(/^\[[^\]]+\]\s*/, "");

  const rawBodyBn = (raw.body_bn || raw.summary_bn || "").trim();
  const rawBodyEn = (raw.body_en || raw.summary_en || "").trim();

  const isGenericSummary = (s: string) =>
    /leading english language daily|new age, a dhaka-based|newspaper published from dhaka/i.test(s);

  const firstParaBn = rawBodyBn.split(/\n{2,}/)[0] || raw.summary_bn;
  const firstParaEn = rawBodyEn.split(/\n{2,}/)[0] || raw.summary_en;

  const cleanSummaryBn = isGenericSummary(raw.summary_bn) ? firstParaBn.slice(0, 260) : raw.summary_bn;
  const cleanSummaryEn = isGenericSummary(raw.summary_en) ? firstParaEn.slice(0, 260) : raw.summary_en;

  return {
    ...raw,
    title_bn: override?.title_bn || cleanBnTitle,
    summary_bn: override?.summary_bn || cleanSummaryBn,
    body_bn: override?.body_bn || rawBodyBn,
    title_en: override?.title_en || cleanEnTitle,
    summary_en: override?.summary_en || cleanSummaryEn,
    body_en: override?.body_en || rawBodyEn,
    image_cdn_url: buildCdnImageUrl(raw.image_url),
  };
}

export async function getArticles(limit = 60): Promise<Article[]> {
  const sb = getSupabasePublicClient();
  if (sb) {
    const { data, error } = await sb
      .from("articles")
      .select("*, article_sources(*)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row: Record<string, unknown>) => {
        const token = row.image_cdn_token as string | null;
        const cdnBase = process.env.NEXT_PUBLIC_CDN_BASE_URL?.replace(/\/$/, "");
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
      });
    }
  }

  if (!fs.existsSync(ARTICLES_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(ARTICLES_FILE, "utf8")) as Article[];
    return raw.slice(0, limit).map(enrichArticle);
  } catch {
    return [];
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const all = await getArticles(120);
  return all.find((a) => a.slug === slug) ?? null;
}

export async function getIngestLogs(): Promise<IngestLogRecord[]> {
  if (!fs.existsSync(INGEST_LOGS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INGEST_LOGS_FILE, "utf8")) as IngestLogRecord[];
  } catch {
    return [];
  }
}

export async function upsertArticlesFromIngest(
  incoming: Article[],
  patLabel: string,
  sourcesScanned: number,
  revalidatedPaths: string[],
): Promise<{ upserted: number; backend: "supabase" | "local" }> {
  const sb = getSupabaseServiceClient();
  if (sb) {
    const rows = incoming.map((item) => ({
      id: item.id,
      slug: item.slug,
      lang: item.lang || "bn",
      category: item.category || "national",
      region: item.region || "national",
      title_bn: item.title_bn,
      title_en: item.title_en,
      summary_bn: item.summary_bn,
      summary_en: item.summary_en,
      body_bn: item.body_bn ?? item.summary_bn,
      body_en: item.body_en ?? item.summary_en,
      verification_status: item.verification_status,
      confidence_score: item.confidence_score,
      source_count: item.source_count,
      primary_source: item.primary_source,
      primary_source_bn: item.primary_source_bn,
      source_url: item.source_url,
      image_cdn_token: buildCdnImageToken(item.image_url),
      image_alt_bn: item.image_alt || item.title_bn,
      image_alt_en: item.image_alt || item.title_en,
      seo_title_bn: item.title_bn.slice(0, 60),
      seo_title_en: item.title_en.slice(0, 60),
      seo_desc_bn: item.summary_bn.slice(0, 155),
      seo_desc_en: item.summary_en.slice(0, 155),
      status: "published",
      published_at: item.published_at || new Date().toISOString(),
    }));

    const { error } = await sb.from("articles").upsert(rows, { onConflict: "slug" });
    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
    return { upserted: rows.length, backend: "supabase" };
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const current: Article[] = fs.existsSync(ARTICLES_FILE)
    ? (JSON.parse(fs.readFileSync(ARTICLES_FILE, "utf8")) as Article[])
    : [];

  const bySlug = new Map<string, Article>();
  for (const item of incoming) bySlug.set(item.slug, item);
  for (const existing of current) {
    if (!bySlug.has(existing.slug)) bySlug.set(existing.slug, existing);
  }

  const merged = Array.from(bySlug.values()).slice(0, 120);
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(merged, null, 2), "utf8");

  const logs = await getIngestLogs();
  logs.unshift({
    id: `log_${Date.now()}`,
    patLabel,
    articlesUpserted: incoming.length,
    sourcesScanned,
    revalidatedPaths,
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(INGEST_LOGS_FILE, JSON.stringify(logs.slice(0, 50), null, 2), "utf8");

  return { upserted: incoming.length, backend: "local" };
}
