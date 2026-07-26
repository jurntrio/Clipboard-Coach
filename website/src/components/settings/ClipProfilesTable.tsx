"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StandardTag } from "@/types/database";
import { useI18n } from "@/i18n/client";

type Draft = { start: string; end: string };

export function ClipProfilesTable() {
  const { t } = useI18n();
  const [tags, setTags] = useState<StandardTag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const supabase = createClient();

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at");
    const clipTags = (data ?? []).filter((tag) => !["start", "end"].includes(tag.name.trim().toLowerCase()));
    setTags(clipTags);
    setDrafts(Object.fromEntries(clipTags.map((tag) => [tag.id, {
      start: String(tag.start_offset_seconds),
      end: String(tag.end_offset_seconds)
    }])));
  }

  async function save(tag: StandardTag) {
    const draft = drafts[tag.id];
    const start = Number(draft?.start);
    const end = Number(draft?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) { setNotice(t("clipProfiles.needTwoNumbers")); return; }
    if (start > end) { setNotice(t("clipProfiles.startMustBeBeforeEnd")); return; }
    setSavingId(tag.id);
    setNotice("");
    const { error } = await supabase.from("standard_tags").update({
      start_offset_seconds: start,
      end_offset_seconds: end
    }).eq("id", tag.id);
    setSavingId("");
    if (error) setNotice(error.message);
    else {
      setTags((current) => current.map((item) => item.id === tag.id ? { ...item, start_offset_seconds: start, end_offset_seconds: end } : item));
      setNotice(t("clipProfiles.savedNotice", { name: tag.name }));
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left">
          <thead className="bg-cardDeep text-xs uppercase tracking-wider text-textMuted"><tr><th className="px-4 py-3">{t("clipProfiles.tag")}</th><th className="px-4 py-3">{t("clipProfiles.startOffset")}</th><th className="px-4 py-3">{t("clipProfiles.endOffset")}</th><th className="px-4 py-3 text-right">{t("clipProfiles.action")}</th></tr></thead>
          <tbody className="divide-y divide-border">
            {tags.map((tag) => {
              const dirty = Number(drafts[tag.id]?.start) !== Number(tag.start_offset_seconds) || Number(drafts[tag.id]?.end) !== Number(tag.end_offset_seconds);
              return <tr key={tag.id} className="text-sm text-textPrimary">
                <td className="px-4 py-3 font-semibold">{tag.name}</td>
                {(["start", "end"] as const).map((field) => <td key={field} className="px-4 py-3"><label className="inline-flex items-center gap-2"><input type="number" step="0.5" value={drafts[tag.id]?.[field] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [tag.id]: { ...(current[tag.id] ?? { start: "", end: "" }), [field]: event.target.value } }))} className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-right text-textPrimary focus:border-accent focus:outline-none" /><span className="text-textMuted">{t("clipProfiles.seconds")}</span></label></td>)}
                <td className="px-4 py-3 text-right"><button type="button" disabled={!dirty || savingId === tag.id} onClick={() => void save(tag)} className="rounded-lg bg-accent px-3 py-2 font-semibold text-page disabled:opacity-35">{savingId === tag.id ? t("common.saving") : t("common.save")}</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!tags.length && <p className="mt-3 text-sm text-textMuted">{t("clipProfiles.noTagsYet")}</p>}
      {notice && <p className="mt-3 text-sm text-textSecondary" role="status">{notice}</p>}
    </div>
  );
}
