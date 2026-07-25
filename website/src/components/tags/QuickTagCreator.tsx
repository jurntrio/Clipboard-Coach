"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StandardTag } from "@/types/database";
import { useI18n } from "@/i18n/client";

export function QuickTagCreator({ onCreated }: { onCreated: (tag: StandardTag) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const { t } = useI18n();

  async function createTag(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(t("errors.sessionExpired"));
      setSaving(false);
      return;
    }
    const { data, error: insertError } = await supabase.from("standard_tags").insert({ coach_id: user.id, name: name.trim() }).select().single();
    if (insertError) {
      setError(insertError.code === "23505" ? t("tag.alreadyExists") : insertError.message);
      setSaving(false);
      return;
    }
    await onCreated(data);
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
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-button px-3 py-2 text-textPrimary">{t("common.cancel")}</button>
              <button type="submit" disabled={!name.trim() || saving} className="flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-page disabled:opacity-50">{saving ? t("common.saving") : t("tag.addAction")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
