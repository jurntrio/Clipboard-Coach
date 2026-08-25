"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

export function PhaseTagDialog({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    await onConfirm(name.trim());
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onClick={onCancel}>
      <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-xl border border-borderButton bg-cardAlt p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-textBright">{t("phaseTag.dialogTitle")}</h2>
          <button type="button" onClick={onCancel} aria-label={t("common.cancel")} className="text-textMuted hover:text-textPrimary">&times;</button>
        </div>
        <label className="text-sm text-textSecondary">{t("tag.name")}
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t("phaseTag.namePlaceholder")} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary focus:border-accent focus:outline-none" />
        </label>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg bg-button px-3 py-2 text-textPrimary">{t("common.cancel")}</button>
          <button type="submit" disabled={!name.trim() || saving} className="flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{saving ? t("common.saving") : t("phaseTag.save")}</button>
        </div>
      </form>
    </div>
  );
}
