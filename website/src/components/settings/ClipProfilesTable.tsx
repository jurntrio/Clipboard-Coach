"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StandardTag } from "@/types/database";
import { useI18n } from "@/i18n/client";

type Draft = { start: string; end: string };
type TagMode = "live" | "video";

export function ClipProfilesTable() {
  const { t } = useI18n();
  const [tags, setTags] = useState<StandardTag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<TagMode, Draft>>>({});
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
      live: {
        start: String(tag.live_start_offset_seconds ?? tag.start_offset_seconds),
        end: String(tag.live_end_offset_seconds ?? tag.end_offset_seconds)
      },
      video: {
        start: String(tag.video_start_offset_seconds ?? tag.start_offset_seconds),
        end: String(tag.video_end_offset_seconds ?? tag.end_offset_seconds)
      }
    }])));
  }

  async function save(tag: StandardTag) {
    const live = drafts[tag.id]?.live;
    const video = drafts[tag.id]?.video;
    const values = [Number(live?.start), Number(live?.end), Number(video?.start), Number(video?.end)];
    if (values.some(value => !Number.isFinite(value))) { setNotice(t("clipProfiles.needFourNumbers")); return; }
    if (values[0] > values[1] || values[2] > values[3]) { setNotice(t("clipProfiles.startMustBeBeforeEnd")); return; }
    setSavingId(tag.id);
    setNotice("");
    const fields = { live_start_offset_seconds: values[0], live_end_offset_seconds: values[1], video_start_offset_seconds: values[2], video_end_offset_seconds: values[3] };
    const { error } = await supabase.from("standard_tags").update(fields).eq("id", tag.id);
    setSavingId("");
    if (error) setNotice(error.message);
    else {
      setTags((current) => current.map((item) => item.id === tag.id ? { ...item, ...fields } : item));
      setNotice(t("clipProfiles.savedNotice", { name: tag.name }));
    }
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-borderSubtle bg-cardDeep p-3"><h3 className="font-bold text-textBright">{t("clipProfiles.liveTags")}</h3><p className="mt-1 text-sm text-textMuted">{t("clipProfiles.liveTagsHelp")}</p></div>
        <div className="rounded-xl border border-borderSubtle bg-cardDeep p-3"><h3 className="font-bold text-textBright">{t("clipProfiles.videoTags")}</h3><p className="mt-1 text-sm text-textMuted">{t("clipProfiles.videoTagsHelp")}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-cardDeep text-xs uppercase tracking-wider text-textMuted">
            <tr><th rowSpan={2} className="px-4 py-3 align-bottom">{t("clipProfiles.tag")}</th><th colSpan={2} className="border-l border-border px-4 py-2 text-center text-accent">{t("clipProfiles.liveTags")}</th><th colSpan={2} className="border-l border-border px-4 py-2 text-center text-accent">{t("clipProfiles.videoTags")}</th><th rowSpan={2} className="px-4 py-3 text-right align-bottom">{t("clipProfiles.action")}</th></tr>
            <tr><th className="border-l border-border px-4 py-2">{t("clipProfiles.startOffset")}</th><th className="px-4 py-2">{t("clipProfiles.endOffset")}</th><th className="border-l border-border px-4 py-2">{t("clipProfiles.startOffset")}</th><th className="px-4 py-2">{t("clipProfiles.endOffset")}</th></tr>
          </thead>
          <tbody className="divide-y divide-border">{tags.map(tag => {
            const liveStart = tag.live_start_offset_seconds ?? tag.start_offset_seconds;
            const liveEnd = tag.live_end_offset_seconds ?? tag.end_offset_seconds;
            const videoStart = tag.video_start_offset_seconds ?? tag.start_offset_seconds;
            const videoEnd = tag.video_end_offset_seconds ?? tag.end_offset_seconds;
            const draft = drafts[tag.id];
            const dirty = Number(draft?.live.start) !== Number(liveStart) || Number(draft?.live.end) !== Number(liveEnd) || Number(draft?.video.start) !== Number(videoStart) || Number(draft?.video.end) !== Number(videoEnd);
            const cell = (mode: TagMode, field: keyof Draft, border = false) => <td className={`px-4 py-3 ${border ? "border-l border-border" : ""}`}><label className="inline-flex items-center gap-2"><input type="number" step="0.5" value={drafts[tag.id]?.[mode]?.[field] ?? ""} onChange={event => setDrafts(current => ({ ...current, [tag.id]: { ...(current[tag.id] ?? { live: { start: "", end: "" }, video: { start: "", end: "" } }), [mode]: { ...(current[tag.id]?.[mode] ?? { start: "", end: "" }), [field]: event.target.value } } }))} className="w-20 rounded-lg border border-border bg-input px-2 py-2 text-right text-textPrimary focus:border-accent focus:outline-none" /><span className="text-textMuted">{t("clipProfiles.seconds")}</span></label></td>;
            return <tr key={tag.id} className="text-sm text-textPrimary"><td className="px-4 py-3 font-semibold">{tag.name}</td>{cell("live", "start", true)}{cell("live", "end")}{cell("video", "start", true)}{cell("video", "end")}<td className="px-4 py-3 text-right"><button type="button" disabled={!dirty || savingId === tag.id} onClick={() => void save(tag)} className="rounded-lg bg-accent px-3 py-2 font-semibold text-page disabled:opacity-35">{savingId === tag.id ? t("common.saving") : t("common.save")}</button></td></tr>;
          })}</tbody>
        </table>
      </div>
      {!tags.length && <p className="text-sm text-textMuted">{t("clipProfiles.noTagsYet")}</p>}
      {notice && <p className="mt-3 text-sm text-textSecondary" role="status">{notice}</p>}
    </div>
  );
}
