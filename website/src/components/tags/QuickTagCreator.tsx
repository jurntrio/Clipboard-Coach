"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { uniqueTagNames } from "@/lib/tag-names";

export function QuickTagCreator({ onCreated, existingTags = [] }: { onCreated: (name: string) => void | Promise<void>; existingTags?: string[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();
  const choices = uniqueTagNames(existingTags);

  async function createTag(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    await onCreated(name.trim());
    setName("");
    setSaving(false);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg border border-dashed border-accent bg-accentDim px-3 py-2 text-sm font-semibold text-accent hover:bg-cardHover">{t("tag.add")}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={createTag} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-xl border border-borderButton bg-cardAlt p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-textBright">{t("tag.new")}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-textMuted hover:text-textPrimary">&times;</button>
            </div>
            <label className="text-sm text-textSecondary">{t("tag.name")}
              <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t("tag.example")} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary focus:border-accent focus:outline-none" />
            </label>
            {!!choices.length && <label className="mt-4 block text-sm text-textSecondary">{t("tag.existingTags")}
              <select value="" onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary focus:border-accent focus:outline-none">
                <option value="">{t("tag.chooseExisting")}</option>
                {choices.map((tag) => <option key={tag.toLocaleLowerCase()} value={tag}>{tag}</option>)}
              </select>
            </label>}
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-button px-3 py-2 text-textPrimary">{t("common.cancel")}</button>
              <button type="submit" disabled={!name.trim() || saving} className="flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{saving ? t("common.saving") : t("tag.addAction")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
