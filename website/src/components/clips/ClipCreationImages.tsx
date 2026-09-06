"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { defaultClipIntro, type ClipIntro, type IntroMatch } from "@/lib/clip-intro";
import { emptyClipImages, type ClipImages } from "@/lib/clip-images";
import { ClipIntroCard } from "./ClipIntroCard";

const input = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary";
type Source = { allowed: boolean; teamName: string | null; matchCard: IntroMatch };

export function ClipCreationImages({ videoId, tags, value, onChange, onReady, disabled }: {
  videoId: string; tags: Array<{ id: string; name: string }>; value: ClipImages; onChange: (value: ClipImages) => void; onReady: (ready: boolean) => void; disabled: boolean;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    onReady(false); setSource(null); setError("");
    fetch(`/api/videos/${videoId}/clip-images`, { cache: "no-store" }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (active) { setSource(body); if (!body.allowed) onChange(emptyClipImages()); onReady(true); }
    }).catch(reason => { if (active) setError(reason.message || "De ploeginstelling kon niet worden geladen."); });
    return () => { active = false; };
  }, [videoId, attempt, onReady, onChange]);

  function opening(patch: Partial<ClipIntro>) {
    onChange({ ...value, opening: { ...defaultClipIntro, ...value.opening, ...patch, enabled: true } });
  }
  async function upload(file: File, target: "opening" | "sponsor" | string) {
    setError(""); setUploading(true); onReady(false);
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Kies PNG, JPEG of WebP, maximaal 5 MB.");
      const form = new FormData(); form.set("image", file);
      const response = await fetch(`/api/videos/${videoId}/clip-images`, { method: "POST", body: form });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (target === "opening") opening({ imageUrl: body.url });
      else if (target === "sponsor") opening({ sponsorLogoUrl: body.url });
      else onChange({ ...value, tags: { ...value.tags, [target]: { key: body.key, url: body.url, duration: value.tags[target]?.duration ?? 2 } } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload mislukt."); }
    finally { setUploading(false); onReady(true); }
  }
  function fileInput(target: string) {
    return <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-xs" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, target); event.target.value = ""; }} />;
  }

  if (!source) return <div className="mt-4 text-sm text-textMuted"><p>{error || "Ploeginstelling voor clipbeelden laden…"}</p>{error && <div className="mt-2 flex gap-3"><button type="button" className="text-accent" onClick={() => setAttempt(value => value + 1)}>Opnieuw proberen</button><button type="button" className="text-accent" onClick={() => { onChange(emptyClipImages()); onReady(true); setSource({ allowed: false, teamName: null, matchCard: { teamA: "", teamB: "", logoA: null, logoB: null, score: "" } }); }}>Verder zonder beelden</button></div>}</div>;
  if (!source.allowed) return <p className="mt-4 text-xs text-textMuted">Introbeelden zijn uitgeschakeld voor {source.teamName || "deze ploeg"}. Een beheerder kan ze toestaan via Clubbeheer → Teams & spelers → Bewerken.</p>;
  return <fieldset disabled={disabled || uploading} className="mt-4 space-y-4 rounded-xl border border-accent/30 bg-cardDeep p-4 disabled:opacity-60">
    <legend className="px-2 font-semibold text-accent">Beelden bij deze clip · {source.teamName}</legend>
    <p className="text-xs text-textMuted">Optioneel. De gekozen beelden komen in het videobestand en zijn zichtbaar in de preview, download en deellink.</p>
    <label className="flex items-center gap-2 text-sm font-bold text-textPrimary"><input type="checkbox" checked={!!value.opening} onChange={event => onChange({ ...value, opening: event.target.checked ? { ...defaultClipIntro, enabled: true } : null })} />Introbeeld vóór de volledige clip</label>
    {value.opening && <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-textSecondary">Type<select className={input} value={value.opening.mode} onChange={event => opening({ mode: event.target.value as ClipIntro["mode"] })}><option value="match">Wedstrijdkaart met ploeglogo’s</option><option value="sponsor">Wedstrijdkaart met sponsor</option><option value="upload">Eigen afbeelding</option></select></label>
      <label className="text-xs text-textSecondary">Duur in seconden<input className={input} type="number" min="0.5" max="60" step="0.5" value={Number.isFinite(value.opening.duration) ? value.opening.duration : ""} onChange={event => opening({ duration: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
      {value.opening.mode !== "upload" && <div className="sm:col-span-2"><label className="flex items-center gap-2 text-xs text-textSecondary"><input type="checkbox" checked={value.opening.showScore} onChange={event => opening({ showScore: event.target.checked })} />Score tonen</label>{value.opening.showScore && <label className="mt-2 block text-xs text-textSecondary">Score naar keuze (leeg = opgeslagen wedstrijdstand)<input className={input} value={value.opening.score} maxLength={30} placeholder={source.matchCard.score || "3 – 2"} onChange={event => opening({ score: event.target.value })} /></label>}</div>}
      {value.opening.mode === "sponsor" && <>
        <label className="text-xs text-textSecondary">Benaming<input className={input} list="creation-sponsor-labels" maxLength={80} value={value.opening.sponsorLabel} onChange={event => opening({ sponsorLabel: event.target.value })} /><datalist id="creation-sponsor-labels"><option value="Wedstrijdsponsor" /><option value="Balsponsor" /><option value="Schenker wedstrijdbal" /></datalist></label>
        <label className="text-xs text-textSecondary">Naam sponsor<input className={input} maxLength={160} value={value.opening.sponsorName} onChange={event => opening({ sponsorName: event.target.value })} /></label>
        <label className="text-xs text-textSecondary sm:col-span-2">Sponsorlogo uploaden{fileInput("sponsor")}</label>
      </>}
      {value.opening.mode === "upload" && <label className="text-xs text-textSecondary sm:col-span-2">Eigen afbeelding uploaden{fileInput("opening")}</label>}
      <div className="overflow-hidden rounded-lg border border-border sm:col-span-2"><ClipIntroCard settings={value.opening} match={source.matchCard} /></div>
    </div>}
    <div className="space-y-2 border-t border-border pt-3"><h4 className="text-sm font-semibold text-textPrimary">Beeld vóór een afzonderlijke tag</h4><p className="text-xs text-textMuted">Bij meerdere camera’s verschijnt het beeld eenmaal, vóór de eerste camera van die tag.</p>
      {tags.map(tag => <div key={tag.id} className="rounded-lg border border-border bg-card p-3">
        <label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={!!value.tags[tag.id]} onChange={event => { const next = { ...value.tags }; if (event.target.checked) next[tag.id] = { key: "", url: "", duration: 2 }; else delete next[tag.id]; onChange({ ...value, tags: next }); }} />Beeld vóór {tag.name}</label>
        {value.tags[tag.id] && <div className="mt-2 grid items-center gap-3 sm:grid-cols-2"><label className="text-xs text-textSecondary">Afbeelding uploaden{fileInput(tag.id)}</label><label className="text-xs text-textSecondary">Duur in seconden<input className={input} type="number" min="0.5" max="60" step="0.5" value={Number.isFinite(value.tags[tag.id].duration) ? value.tags[tag.id].duration : ""} onChange={event => onChange({ ...value, tags: { ...value.tags, [tag.id]: { ...value.tags[tag.id], duration: event.target.value === "" ? NaN : Number(event.target.value) } } })} /></label>{value.tags[tag.id].url && <Image src={value.tags[tag.id].url} alt={`Beeld vóór ${tag.name}`} width={480} height={270} unoptimized className="max-h-40 w-full rounded bg-black object-contain sm:col-span-2" />}</div>}
      </div>)}
    </div>
    <p className="text-xs text-textMuted">PNG, JPEG of WebP · maximaal 5 MB per upload · duur 0,5–60 seconden</p>
    {uploading && <p role="status" className="text-sm text-accent">Afbeelding uploaden…</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </fieldset>;
}
