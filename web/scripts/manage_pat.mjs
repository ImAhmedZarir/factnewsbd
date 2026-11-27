#!/usr/bin/env node
/**
 * Offline CLI PAT Manager for FactNews Bangladesh
 * Saves SHA-256 token hashes to local data/pats.json AND syncs to Supabase pat_tokens
 * when web/.env.local or environment variables specify SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   node scripts/manage_pat.mjs list
 *   node scripts/manage_pat.mjs create "Daily BD Scraper"
 *   node scripts/manage_pat.mjs revoke <pat_id>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");
const PAT_FILE = path.join(DATA_DIR, "pats.json");

function loadEnvLocal() {
  const envFile = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PAT_FILE)) return [];
  return JSON.parse(fs.readFileSync(PAT_FILE, "utf8"));
}

function save(records) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PAT_FILE, JSON.stringify(records, null, 2), "utf8");
}

function getSupabase() {
  loadEnvLocal();
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key } : null;
}

const [cmd, arg] = process.argv.slice(2);
const sb = getSupabase();

if (cmd === "create") {
  const label = arg || "FactNews Bangladesh Scraper Agent";
  const rawToken = `news_pat_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const record = {
    id: `pat_${crypto.randomBytes(6).toString("hex")}`,
    label,
    tokenPrefix: rawToken.slice(0, 16),
    tokenHash,
    scopes: ["news:write", "factcheck:write", "revalidate"],
    isActive: true,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  const records = load();
  records.unshift(record);
  save(records);

  let synced = "local-only";
  if (sb) {
    const res = await fetch(`${sb.url}/rest/v1/pat_tokens`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        label,
        token_prefix: record.tokenPrefix,
        token_hash: tokenHash,
        scopes: record.scopes,
        is_active: true,
      }),
    });
    synced = res.ok ? "supabase+local" : `supabase-error(${res.status})`;
  }
  console.log(JSON.stringify({ id: record.id, label, rawToken, storage: synced }, null, 2));
} else if (cmd === "revoke") {
  if (!arg) {
    console.error("Usage: node scripts/manage_pat.mjs revoke <id>");
    process.exit(1);
  }
  const records = load().map((r) => (r.id === arg ? { ...r, isActive: false } : r));
  save(records);

  if (sb) {
    await fetch(`${sb.url}/rest/v1/pat_tokens?id=eq.${encodeURIComponent(arg)}`, {
      method: "PATCH",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: false }),
    }).catch(() => undefined);
  }
  console.log("Revoked:", arg);
} else {
  const safe = load().map(({ tokenHash: _omit, ...rest }) => rest);
  console.log(JSON.stringify({ local: safe, supabaseConfigured: Boolean(sb) }, null, 2));
}
