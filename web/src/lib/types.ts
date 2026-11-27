export type Language = "bn" | "en";

export type NewsCategory =
  | "all"
  | "national"
  | "politics"
  | "economy"
  | "international"
  | "sports"
  | "tech"
  | "entertainment"
  | "regional";

export type VerificationStatus =
  | "verified"
  | "corroborated"
  | "single_source"
  | "fact_check"
  | "disputed";

export interface CorroboratingSource {
  sourceId: string;
  nameEn: string;
  nameBn: string;
  domain: string;
  url: string;
  tier: number;
  headline: string;
}

export interface Article {
  id: string;
  slug: string;
  lang: Language;
  category: Exclude<NewsCategory, "all">;
  region: string;
  title_bn: string;
  title_en: string;
  summary_bn: string;
  summary_en: string;
  body_bn?: string;
  body_en?: string;
  verification_status: VerificationStatus;
  confidence_score: number;
  source_count: number;
  primary_source: string;
  primary_source_bn: string;
  source_url: string;
  image_url: string | null;
  image_cdn_url?: string | null;
  image_alt: string;
  published_at: string;
  is_breaking?: boolean;
  sources: CorroboratingSource[];
}

export interface PatTokenRecord {
  id: string;
  label: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface IngestLogRecord {
  id: string;
  patLabel: string;
  articlesUpserted: number;
  sourcesScanned: number;
  revalidatedPaths: string[];
  createdAt: string;
}
