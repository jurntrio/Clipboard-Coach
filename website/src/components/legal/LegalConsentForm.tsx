"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { SvsBrand } from "@/components/branding/SvsBrand";

export function LegalConsentForm() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError(t("consent.required"));
      return;
    }

    setSaving(true);
    setError("");
    const response = await fetch("/api/legal-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale })
    });

    if (!response.ok) {
      setError(t("consent.failed"));
      setSaving(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10 text-textPrimary">
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8">
      <div className="mb-6 flex items-center justify-between gap-4"><SvsBrand width={280} height={70} className="w-full max-w-[280px]" /><LanguageSwitcher compact /></div>
      <h1 className="font-display text-2xl uppercase text-textBright">{t("consent.title")}</h1>
      <p className="mt-3 text-sm leading-6 text-textSecondary">{t("consent.intro")}</p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-accent"><Link href="/terms" target="_blank" className="hover:underline">{t("legal.terms")} ({TERMS_VERSION})</Link><Link href="/privacy" target="_blank" className="hover:underline">{t("legal.privacy")} ({PRIVACY_VERSION})</Link><Link href="/children-and-images" target="_blank" className="hover:underline">{t("legal.children")}</Link></div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="flex items-start gap-3 rounded-lg border border-border bg-cardDeep p-4 text-sm leading-6 text-textSecondary"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>{t("consent.checkbox")}</span></label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={saving || !accepted} className="w-full rounded-lg bg-accent px-4 py-3 font-bold text-page hover:opacity-90 disabled:opacity-50">{saving ? t("consent.saving") : t("consent.submit")}</button>
      </form>
    </div>
  </div>;
}
