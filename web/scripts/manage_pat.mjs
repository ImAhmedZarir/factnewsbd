#!/usr/bin/env node
/**
 * Offline CLI PAT Manager for FactNews Bangladesh
 * Never exposes PAT creation or audit history over public HTTP endpoints.
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

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PAT_FILE)) return [];
  return JSON.parse(fs.readFileSync(PAT_FILE, "utf8"));
}

function save(records) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PAT_FILE, JSON.stringify(records, null, 2), "utf8");
}

const [cmd, arg] = process.argv.slice(2);

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
  console.log(JSON.stringify({ id: record.id, label, rawToken }, null, 2));
} else if (cmd === "revoke") {
  if (!arg) {
    console.error("Usage: node scripts/manage_pat.mjs revoke <id>");
    process.exit(1);
  }
  const records = load().map((r) => (r.id === arg ? { ...r, isActive: false } : r));
  save(records);
  console.log("Revoked:", arg);
} else {
  const safe = load().map(({ tokenHash: _omit, ...rest }) => rest);
  console.log(JSON.stringify(safe, null, 2));
}
