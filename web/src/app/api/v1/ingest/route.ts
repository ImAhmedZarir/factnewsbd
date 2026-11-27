import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { verifyPatBearer } from "@/lib/pat";
import { getIngestLogs, upsertArticlesFromIngest } from "@/lib/store";
import type { Article } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await verifyPatBearer(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ ok: true, service: "FactNews Bangladesh Ingest API" });
  }
  const logs = await getIngestLogs();
  return NextResponse.json({
    ok: true,
    mode: process.env.SUPABASE_URL ? "supabase" : "local-json",
    recent_ingests: logs.slice(0, 10),
  });
}

export async function POST(request: NextRequest) {
  const auth = await verifyPatBearer(request.headers.get("authorization"));
  if (!auth.ok || !auth.pat) {
    return NextResponse.json(
      { error: auth.reason || "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { articles?: Partial<Article>[]; source_report?: { working_sources?: number } };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const rawArticles = Array.isArray(body.articles) ? body.articles : [];
  if (rawArticles.length === 0) {
    return NextResponse.json(
      { error: "Payload must include non-empty articles[]" },
      { status: 400 },
    );
  }

  const normalized: Article[] = rawArticles.slice(0, 60).map((item, idx) => {
    const titleBn = String(item.title_bn || item.title_en || "").trim();
    const titleEn = String(item.title_en || item.title_bn || "").trim();
    const sourceUrl = String(item.source_url || "https://factnewsbd.com");
    const slugHash = crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 8);
    const slug =
      item.slug?.trim() ||
      `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "story"}-${slugHash}`;

    return {
      id: item.id || `art_${slugHash}_${idx}`,
      slug,
      lang: item.lang === "en" ? "en" : "bn",
      category: item.category || "national",
      region: item.region || "national",
      title_bn: titleBn,
      title_en: titleEn,
      summary_bn: String(item.summary_bn || titleBn),
      summary_en: String(item.summary_en || titleEn),
      body_bn: item.body_bn,
      body_en: item.body_en,
      verification_status: item.verification_status || "single_source",
      confidence_score: Math.min(100, Math.max(0, Number(item.confidence_score ?? 65))),
      source_count: Math.max(1, Number(item.source_count ?? item.sources?.length ?? 1)),
      primary_source: String(item.primary_source || "Newsroom Dispatch"),
      primary_source_bn: String(item.primary_source_bn || item.primary_source || "নিউজরুম"),
      source_url: sourceUrl,
      image_url: item.image_url ?? null,
      image_alt: String(item.image_alt || titleBn || titleEn),
      published_at: item.published_at || new Date().toISOString(),
      is_breaking: Boolean(item.is_breaking),
      sources: Array.isArray(item.sources) ? item.sources : [],
    };
  });

  const pathsToRevalidate = ["/", ...normalized.slice(0, 15).map((a) => `/news/${a.slug}`)];
  const result = await upsertArticlesFromIngest(
    normalized,
    auth.pat.label,
    Number(body.source_report?.working_sources ?? 0),
    pathsToRevalidate,
  );

  for (const p of pathsToRevalidate) {
    revalidatePath(p);
  }

  return NextResponse.json({
    ok: true,
    upserted: result.upserted,
    backend: result.backend,
    revalidated: pathsToRevalidate.length,
    pat_label: auth.pat.label,
  });
}
