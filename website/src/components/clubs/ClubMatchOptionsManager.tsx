"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export type ClubMatchOption = { id: string; club_id: string; option_type: "field" | "locker_room" | "meeting_place" | "non_selection_reason"; label: string };

const groups: Array<{ type: ClubMatchOption["option_type"]; title: string; help: string }> = [
  { type: "field", title: "clubMatchOptions.fields", help: "clubMatchOptions.fieldsHelp" },
  { type: "locker_room", title: "clubMatchOptions.lockerRooms", help: "clubMatchOptions.lockerRoomsHelp" },
  { type: "meeting_place", title: "clubMatchOptions.meetingPlaces", help: "clubMatchOptions.meetingPlacesHelp" },
  { type: "non_selection_reason", title: "clubMatchOptions.reasons", help: "clubMatchOptions.reasonsHelp" }
];

export function ClubMatchOptionsManager({ clubId, options, readOnly, onChanged }: { clubId: string; options: ClubMatchOption[]; readOnly: boolean; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function add(type: ClubMatchOption["option_type"]) {
    const label = drafts[type]?.trim();
    if (!label) return;
    setBusy(type); setNotice("");
    const response = await fetch("/api/club/match-options", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, optionType: type, label })
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) { setNotice(body.error || t("clubMatchOptions.saveFailed")); return; }
    setDrafts(current => ({ ...current, [type]: "" }));
    await onChanged();
  }

  async function remove(option: ClubMatchOption) {
    setBusy(option.id); setNotice("");
    const response = await fetch("/api/club/match-options", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, optionId: option.id })
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) { setNotice(body.error || t("clubMatchOptions.removeFailed")); return; }
    await onChanged();
  }

  return <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold text-textBright">{t("clubMatchOptions.title")}</h2>
    <p className="mt-1 text-sm text-textMuted">{t("clubMatchOptions.subtitle")}</p>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">{groups.map(group => <div key={group.type} className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textPrimary">{t(group.title as any)}</h3>
      <p className="mt-1 text-xs text-textMuted">{t(group.help as any)}</p>
      <div className="mt-3 flex gap-2"><input value={drafts[group.type] ?? ""} disabled={readOnly} onChange={event => setDrafts(current => ({ ...current, [group.type]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /><button type="button" disabled={readOnly || busy === group.type} onClick={() => void add(group.type)} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page">{t("common.add")}</button></div>
      <div className="mt-3 flex flex-wrap gap-2">{options.filter(option => option.option_type === group.type).map(option => <span key={option.id} className="inline-flex items-center gap-2 rounded-full border border-borderButton bg-button px-3 py-1 text-sm text-textPrimary">{option.label}{!readOnly && <button type="button" disabled={busy === option.id} onClick={() => void remove(option)} className="text-red-300" aria-label={t("common.remove")}>×</button>}</span>)}</div>
    </div>)}</div>
    {notice && <p className="mt-3 text-sm text-amber-200">{notice}</p>}
  </section>;
}
