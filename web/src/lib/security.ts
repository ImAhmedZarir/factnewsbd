/**
 * Shared frontend URL & JSON-LD XSS guards.
 */

export function safeHttpUrl(raw: string | null | undefined): string {
  if (!raw) return "#";
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "https:" || u.protocol === "http:") {
      return u.toString();
    }
    return "#";
  } catch {
    return "#";
  }
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
