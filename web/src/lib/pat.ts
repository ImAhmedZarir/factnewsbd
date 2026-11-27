import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { PatTokenRecord } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");
const PAT_FILE = path.join(DATA_DIR, "pats.json");

function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function hashPat(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

function safeCompareHash(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function ensurePatStore(): PatTokenRecord[] {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PAT_FILE)) {
      fs.writeFileSync(PAT_FILE, "[]", "utf8");
      return [];
    }
    return JSON.parse(fs.readFileSync(PAT_FILE, "utf8")) as PatTokenRecord[];
  } catch {
    return [];
  }
}

function savePatStore(records: PatTokenRecord[]): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PAT_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch {
    // Edge/Worker runtime without writable filesystem
  }
}

export function listPatTokens(): Omit<PatTokenRecord, "tokenHash">[] {
  return ensurePatStore().map(({ tokenHash: _omit, ...rest }) => rest);
}

export function createPatToken(label: string, scopes?: string[]): {
  rawToken: string;
  record: Omit<PatTokenRecord, "tokenHash">;
} {
  const secretBytes = crypto.randomBytes(24).toString("base64url");
  const rawToken = `news_pat_${secretBytes}`;
  const record: PatTokenRecord = {
    id: `pat_${crypto.randomBytes(6).toString("hex")}`,
    label: label.trim() || "FactNews Scraper Agent",
    tokenPrefix: rawToken.slice(0, 16),
    tokenHash: hashPat(rawToken),
    scopes: scopes?.length ? scopes : ["news:write", "revalidate"],
    isActive: true,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  const existing = ensurePatStore();
  existing.unshift(record);
  savePatStore(existing);
  const { tokenHash: _omit, ...safeRecord } = record;
  return { rawToken, record: safeRecord };
}

export function revokePatToken(id: string): boolean {
  const existing = ensurePatStore();
  let changed = false;
  const updated = existing.map((item) => {
    if (item.id === id && item.isActive) {
      changed = true;
      return { ...item, isActive: false };
    }
    return item;
  });
  if (changed) savePatStore(updated);
  return changed;
}

export async function verifyPatBearer(authHeader: string | null): Promise<{
  ok: boolean;
  pat?: PatTokenRecord;
  reason?: string;
}> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "Missing Authorization: Bearer <PAT> header" };
  }
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken.startsWith("news_pat_") || rawToken.length < 24) {
    return { ok: false, reason: "Malformed PAT format" };
  }

  const incomingHash = hashPat(rawToken);

  // 1. Env master PAT (works everywhere including Cloudflare Edge/Workers)
  const envPat = process.env.INGEST_PAT_SECRET;
  if (envPat && safeCompareHash(incomingHash, hashPat(envPat))) {
    return {
      ok: true,
      pat: {
        id: "pat_env_master",
        label: "Env Master Agent PAT",
        tokenPrefix: rawToken.slice(0, 16),
        tokenHash: incomingHash,
        scopes: ["news:write", "revalidate"],
        isActive: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
    };
  }

  // 2. Supabase pat_tokens table (Cloudflare production)
  const sb = getSupabaseServiceClient();
  if (sb) {
    const { data } = await sb
      .from("pat_tokens")
      .select("id, label, token_prefix, token_hash, scopes, is_active, created_at, last_used_at")
      .eq("token_hash", incomingHash)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      await sb
        .from("pat_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);
      return {
        ok: true,
        pat: {
          id: String(data.id),
          label: String(data.label),
          tokenPrefix: String(data.token_prefix),
          tokenHash: String(data.token_hash),
          scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : ["news:write"],
          isActive: Boolean(data.is_active),
          createdAt: String(data.created_at),
          lastUsedAt: new Date().toISOString(),
        },
      };
    }
  }

  // 3. Local JSON fallback
  const records = ensurePatStore();
  const found = records.find((r) => r.isActive && safeCompareHash(incomingHash, r.tokenHash));
  if (!found) {
    return { ok: false, reason: "Invalid or revoked PAT" };
  }

  found.lastUsedAt = new Date().toISOString();
  savePatStore(records);
  return { ok: true, pat: found };
}
