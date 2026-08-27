"use client";

import { useEffect, useState } from "react";

type ClubLiveTag = { id?: string; name: string; live_start_offset_seconds: number; live_end_offset_seconds: number };

export function ClubLiveTagsManager({ clubId, readOnly }: { clubId: string; readOnly: boolean }) {
  const [tags, setTags] = useState<ClubLiveTag[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch(`/api/club/live-tags?clubId=${encodeURIComponent(clubId)}`, { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setTags(body.tags ?? []); })
      .catch(error => setNotice(error.message || "Live-tags konden niet worden geladen."));
  }, [clubId]);

  function update(index: number, values: Partial<ClubLiveTag>) {
    setTags(current => current.map((tag, itemIndex) => itemIndex === index ? { ...tag, ...values } : tag));
  }

  async function save() {
    setSaving(true); setNotice("");
    const response = await fetch("/api/club/live-tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      clubId, tags: tags.map(tag => ({ name: tag.name, liveStartOffsetSeconds: Number(tag.live_start_offset_seconds), liveEndOffsetSeconds: Number(tag.live_end_offset_seconds) }))
    }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) return setNotice(body.error || "Live-tags konden niet worden bewaard.");
    setNotice("Standaard live-tags bewaard.");
  }

  return <div>
    <h2 className="text-xl font-semibold text-textBright">Standaard live-tags</h2>
    <p className="mt-1 text-sm text-textMuted">Deze knoppen worden automatisch gebruikt voor nieuwe en geïmporteerde wedstrijden. De seconden bepalen het fragment vóór en na het tagmoment.</p>
    <div className="mt-4 space-y-2">{tags.map((tag, index) => <div key={tag.id ?? index} className="grid gap-2 rounded-lg border border-borderSubtle bg-cardDeep p-3 sm:grid-cols-[minmax(180px,1fr)_110px_110px_auto]">
      <input disabled={readOnly} value={tag.name} onChange={event => update(index, { name: event.target.value })} className="rounded border border-border bg-input px-3 py-2 text-sm text-textPrimary" aria-label="Tagnaam" />
      <label className="text-xs text-textMuted">Vanaf (sec.)<input disabled={readOnly} type="number" min="-180" max="180" value={tag.live_start_offset_seconds} onChange={event => update(index, { live_start_offset_seconds: Number(event.target.value) })} className="mt-1 w-full rounded border border-border bg-input px-2 py-2 text-textPrimary" /></label>
      <label className="text-xs text-textMuted">Tot (sec.)<input disabled={readOnly} type="number" min="-180" max="180" value={tag.live_end_offset_seconds} onChange={event => update(index, { live_end_offset_seconds: Number(event.target.value) })} className="mt-1 w-full rounded border border-border bg-input px-2 py-2 text-textPrimary" /></label>
      {!readOnly && <button type="button" onClick={() => setTags(current => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded border border-red-500/30 px-3 py-2 text-sm text-red-300">Verwijderen</button>}
    </div>)}</div>
    {!readOnly && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setTags(current => [...current, { name: "", live_start_offset_seconds: -5, live_end_offset_seconds: 5 }])} className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent">Tag toevoegen</button><button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page disabled:opacity-50">{saving ? "Bewaren…" : "Bewaren"}</button></div>}
    {notice && <p className="mt-2 text-sm text-textMuted">{notice}</p>}
  </div>;
}
