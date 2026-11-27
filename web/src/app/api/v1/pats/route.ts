import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPatToken, listPatTokens, revokePatToken } from "@/lib/pat";

function isAuthorizedAdmin(request: NextRequest): boolean {
  const configuredSecret = process.env.ADMIN_CONSOLE_SECRET;
  if (!configuredSecret || configuredSecret.length < 16) {
    // Hard fail-closed security: PAT management HTTP API stays locked (403)
    // unless an explicit >=16 char ADMIN_CONSOLE_SECRET is configured in .env.local.
    // Locally use `node scripts/manage_pat.mjs` for zero-exposure CLI PAT management.
    return false;
  }

  const headerSecret =
    request.headers.get("x-admin-secret") ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice(7).trim()
      : "");

  if (!headerSecret) return false;
  const a = Buffer.from(headerSecret, "utf8");
  const b = Buffer.from(configuredSecret, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ tokens: listPatTokens() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    scopes?: string[];
  };
  const created = createPatToken(body.label || "BD Scraper Agent", body.scopes);
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const revoked = revokePatToken(id);
  return NextResponse.json({ ok: revoked });
}
