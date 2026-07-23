"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

type Acceptance = { terms_version: string; privacy_version: string; accepted_at: string };

export function PrivacyDataSection() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [action, setAction] = useState<"links" | "account" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { void supabase.from("legal_acceptances").select("terms_version, privacy_version, accepted_at").order("accepted_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setAcceptance(data)); }, []);

  async function exportData() {
    setMessage("");
    const response = await fetch("/api/account/export");
    if (!response.ok) { const body = await response.json().catch(() => null); setMessage(body?.error || t("privacy.exportFailed")); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `clipboard-coach-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }

  async function confirmAction() {
    if (!action) return; setBusy(true); setMessage("");
    const response = await fetch(action === "links" ? "/api/account/share-links" : "/api/account", { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setMessage(body?.error || t("privacy.actionFailed")); setBusy(false); setAction(null); return; }
    if (action === "account") { await supabase.auth.signOut(); router.replace("/"); router.refresh(); return; }
    setMessage(t("privacy.linksRevoked", { count: body.revoked ?? 0 })); setBusy(false); setAction(null);
  }

  return <section className="mt-10 border-t border-border pt-8">
    <h2 className="font-semibold text-textBright">{t("privacy.title")}</h2>
    <p className="mt-1 text-sm text-textMuted">{t("privacy.retention")}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="flex flex-col rounded-lg border border-border bg-cardDeep p-4"><h3 className="text-sm font-semibold text-textBright">{t("privacy.export")}</h3><p className="mt-2 flex-1 text-xs leading-5 text-textMuted">{t("privacy.exportHelp")}</p><button type="button" onClick={() => void exportData()} className="mt-4 rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent">{t("privacy.export")}</button></div>
      <div className="flex flex-col rounded-lg border border-border bg-cardDeep p-4"><h3 className="text-sm font-semibold text-textBright">{t("privacy.revokeLinks")}</h3><p className="mt-2 flex-1 text-xs leading-5 text-textMuted">{t("privacy.revokeLinksHelp")}</p><button type="button" onClick={() => setAction("links")} className="mt-4 rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent">{t("privacy.revokeLinks")}</button></div>
      <div className="flex flex-col rounded-lg border border-red-500/30 bg-red-500/5 p-4"><h3 className="text-sm font-semibold text-red-300">{t("privacy.deleteAccount")}</h3><p className="mt-2 flex-1 text-xs leading-5 text-textMuted">{t("privacy.deleteAccountHelp")}</p><button type="button" onClick={() => setAction("account")} className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20">{t("privacy.deleteAccount")}</button></div>
    </div>
    {message && <p className="mt-3 text-sm text-textSecondary">{message}</p>}
    <div className="mt-5 rounded-lg border border-border bg-cardDeep p-4 text-xs leading-6 text-textMuted"><p>{t("privacy.currentVersions", { terms: TERMS_VERSION, privacy: PRIVACY_VERSION })}</p>{acceptance && <p>{t("privacy.accepted", { date: new Date(acceptance.accepted_at).toLocaleString(locale === "nl" ? "nl-BE" : "en-GB"), terms: acceptance.terms_version, privacy: acceptance.privacy_version })}</p>}</div>
    <div className="mt-4 flex flex-wrap gap-4 text-sm text-accent"><a href="/privacy">{t("legal.privacy")}</a><a href="/terms">{t("legal.terms")}</a><a href="/children-and-images">{t("legal.children")}</a><a href="mailto:info@clipboardcoach.com">info@clipboardcoach.com</a></div>
    <ConfirmDialog open={action === "links"} title={t("privacy.revokeTitle")} message={t("privacy.revokeMessage")} confirmLabel={t("privacy.revokeConfirm")} destructive busy={busy} onCancel={() => setAction(null)} onConfirm={() => void confirmAction()} />
    <ConfirmDialog open={action === "account"} title={t("privacy.deleteTitle")} message={t("privacy.deleteMessage")} confirmLabel={t("privacy.deleteConfirm")} destructive busy={busy} onCancel={() => setAction(null)} onConfirm={() => void confirmAction()} />
  </section>;
}
