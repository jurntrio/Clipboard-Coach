"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export function LinkStaffModal({ teamId, teamName, onClose, onLinked }: { teamId: string; teamName: string; onClose: () => void; onLinked: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function inviteStaff(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/team-staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, email }) });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) { setError(body?.error || t("team.linkFailed")); return; }
    onLinked();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-borderButton bg-cardAlt p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={t("team.linkStaff")}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-textBright">{t("team.linkStaff")}</h2><p className="mt-1 text-sm text-textMuted">{teamName}</p></div><button type="button" onClick={onClose} className="text-sm text-textMuted hover:text-textPrimary">{t("common.close")}</button></div>
        <p className="mt-4 text-sm text-textSecondary">{t("team.linkStaffHelp")}</p>
        <form onSubmit={inviteStaff} className="mt-4">
          <label className="text-sm text-textSecondary">{t("team.registeredName")}<input required type="email" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("team.nameOrEmail")} autoComplete="email" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /></label>
          {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-textSecondary hover:bg-cardHover">{t("common.cancel")}</button><button type="submit" disabled={saving || !email.trim()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{saving ? t("team.linking") : t("team.link")}</button></div>
        </form>
      </div>
    </div>
  );
}
