"use client";

import React, { useState } from "react";
import { Check, Copy, KeyRound, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { PatTokenRecord } from "@/lib/types";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function PatConsoleView() {
  const [adminSecret, setAdminSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Omit<PatTokenRecord, "tokenHash">[]>([]);
  const [label, setLabel] = useState("FactNews Scraper Agent");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = async (secret: string) => {
    setAuthError(null);
    const res = await fetch("/api/v1/pats", {
      headers: { "x-admin-secret": secret },
    });
    if (!res.ok) {
      setUnlocked(false);
      setAuthError("Access denied. Configure ADMIN_CONSOLE_SECRET (>=16 chars) in .env.local or use CLI: node scripts/manage_pat.mjs");
      return;
    }
    const data = (await res.json()) as { tokens: Omit<PatTokenRecord, "tokenHash">[] };
    setTokens(data.tokens || []);
    setUnlocked(true);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadTokens(adminSecret);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/v1/pats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      const data = (await res.json()) as { rawToken: string };
      setCreatedToken(data.rawToken);
      await loadTokens(adminSecret);
    }
  };

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/v1/pats?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-admin-secret": adminSecret },
    });
    if (res.ok) {
      await loadTokens(adminSecret);
    }
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-md border border-border bg-card p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            <span>Private Operator Console</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold text-foreground sm:text-3xl">
            FactNews Bangladesh — Protected PAT Desk
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Protected by server-side <code className="tabular font-semibold">ADMIN_CONSOLE_SECRET</code>. For local CLI management without exposing HTTP endpoints, run{" "}
            <code className="tabular font-semibold">node scripts/manage_pat.mjs create</code>.
          </p>

          {!unlocked ? (
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <div>
                <label htmlFor="admin-secret-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin Console Secret
                </label>
                <input
                  id="admin-secret-input"
                  type="password"
                  required
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  placeholder="Enter ADMIN_CONSOLE_SECRET"
                  className="mt-1.5 h-11 w-full rounded-sm border border-border bg-background px-3 text-base text-foreground sm:text-sm"
                />
              </div>
              {authError && (
                <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <KeyRound className="size-4" aria-hidden="true" />
                <span>Unlock Console</span>
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-6">
              <form onSubmit={handleGenerate} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="h-11 flex-1 rounded-sm border border-border bg-background px-3 text-base text-foreground sm:text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  <span>Issue PAT</span>
                </button>
              </form>

              {createdToken && (
                <div className="rounded-sm border border-success/40 bg-success/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="tabular break-all text-xs font-semibold text-foreground">{createdToken}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(createdToken)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-sm bg-foreground px-2.5 text-xs font-semibold text-background"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-border rounded-sm border border-border">
                {tokens.map((tok) => (
                  <div key={tok.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                        <span>{tok.label}</span>
                      </div>
                      <div className="mt-0.5 tabular text-xs text-muted-foreground">
                        {tok.tokenPrefix}•••• ({tok.isActive ? "Active" : "Revoked"})
                      </div>
                    </div>
                    {tok.isActive && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(tok.id)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-sm border border-destructive/40 px-3 text-xs font-semibold text-destructive"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
