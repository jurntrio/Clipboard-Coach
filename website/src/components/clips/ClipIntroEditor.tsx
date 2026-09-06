"use client";

import { useEffect, useState } from "react";
import { type ClipIntro, type IntroMatch, parseClipIntro } from "@/lib/clip-intro";
import { ClipIntroCard } from "./ClipIntroCard";

type Context = { settings: ClipIntro; matchCard: IntroMatch; matchId: string | null; teamId: string | null; teamName: string | null; canSaveDefaults: boolean };
const input = "w-full rounded-lg border border-borderButton bg-input px-3 py-2 text-sm text-textPrimary";

export function ClipIntroEditor({ token, onReady }: { token: string; onReady: (ready: boolean) => void }) {
  const [context, setContext] = useState<Context | null>(null);
  const [settings, setSettings] = useState<ClipIntro | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMatch, setSaveMatch] = useState(false);
  const [saveTeam, setSaveTeam] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    onReady(false);
    fetch(`/api/clip-intro/${encodeURIComponent(token)}`, { cache: "no-store" }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (active) { setContext(body); setSettings(body.settings); setDirty(false); setError(""); onReady(true); }
    }).catch(reason => { if (active) setError(reason.message || "Introbeeld kon niet worden geladen."); });
    return () => { active = false; };
  }, [token, attempt, onReady]);

  function change(patch: Partial<ClipIntro>) {
    setSettings(current => current ? { ...current, ...patch } : current);
    setDirty(true); onReady(false); setError("");
  }
  async function upload(file: File, field: "imageUrl" | "sponsorLogoUrl") {
    setBusy(true); onReady(false); setError("");
    try {
      const response = await fetch(`/api/clip-intro/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", contentType: file.type, size: file.size }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const put = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Afbeelding kon niet worden geüpload.");
      change({ [field]: body.publicUrl });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload mislukt."); onReady(!dirty); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const valid = parseClipIntro(settings);
      const response = await fetch(`/api/clip-intro/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: valid, saveMatch, saveTeam }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDirty(false); setSaveMatch(false); setSaveTeam(false); onReady(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bewaren mislukt."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 rounded-xl border border-border p-3">
    {!settings || !context ? <><p className="text-sm text-textMuted">{error || "Introbeeld laden…"}</p>{error && <button className="mt-2 text-sm text-accent" onClick={() => setAttempt(value => value + 1)}>Opnieuw proberen</button>}</> : <>
      <label className="flex items-center gap-2 text-sm font-bold text-textPrimary"><input type="checkbox" disabled={busy} checked={settings.enabled} onChange={event => change({ enabled: event.target.checked })} />Introbeeld vóór de clip</label>
      {context.teamName && <p className="mt-1 text-xs text-textMuted">{context.teamName} · aanpasbaar voor deze clip</p>}
      <fieldset disabled={busy} className="mt-3 space-y-3 disabled:opacity-60">
        {settings.enabled && <>
          <label className="block text-xs text-textSecondary">Type intro<select className={`${input} mt-1`} value={settings.mode} onChange={event => change({ mode: event.target.value as ClipIntro["mode"] })}><option value="match">Wedstrijdkaart met ploeglogo’s</option><option value="sponsor">Wedstrijdkaart met sponsor</option><option value="upload">Eigen afbeelding uploaden</option></select></label>
          <label className="block text-xs text-textSecondary">Weergaveduur in seconden<input className={`${input} mt-1`} type="number" min="0.5" max="60" step="0.5" value={Number.isFinite(settings.duration) ? settings.duration : ""} onChange={event => change({ duration: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
          {settings.mode !== "upload" && <><label className="flex items-center gap-2 text-xs text-textSecondary"><input type="checkbox" checked={settings.showScore} onChange={event => change({ showScore: event.target.checked })} />Score tonen</label>{settings.showScore && <label className="block text-xs text-textSecondary">Score (eindstand of stand naar keuze)<input className={`${input} mt-1`} value={settings.score} placeholder={context.matchCard.score || "3 – 2"} maxLength={30} onChange={event => change({ score: event.target.value })} /><span className="mt-1 block">Leeg: de opgeslagen wedstrijdstand.</span></label>}</>}
          {settings.mode === "sponsor" && <>
            <label className="block text-xs text-textSecondary">Benaming<input className={`${input} mt-1`} list="intro-sponsor-labels" value={settings.sponsorLabel} maxLength={80} onChange={event => change({ sponsorLabel: event.target.value })} /><datalist id="intro-sponsor-labels"><option value="Wedstrijdsponsor" /><option value="Balsponsor" /><option value="Schenker wedstrijdbal" /></datalist></label>
            <label className="block text-xs text-textSecondary">Naam sponsor<input className={`${input} mt-1`} value={settings.sponsorName} maxLength={160} onChange={event => change({ sponsorName: event.target.value })} /></label>
          </>}
          {settings.mode !== "match" && <label className="block text-xs text-textSecondary">{settings.mode === "upload" ? "Promotieafbeelding" : "Sponsorlogo"} · PNG, JPEG of WebP, maximaal 5 MB<input className="mt-1 block w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, settings.mode === "upload" ? "imageUrl" : "sponsorLogoUrl"); event.target.value = ""; }} /></label>}
          <div className="overflow-hidden rounded-lg border border-border"><ClipIntroCard settings={settings} match={context.matchCard} /></div>
          <p className="text-xs text-textMuted">Voorbeeld · {Number.isFinite(settings.duration) ? settings.duration : "…"} seconden vóór de clip via de deellink. Downloads bevatten dit introbeeld niet.</p>
        </>}
        {context.canSaveDefaults && <div className="space-y-2 text-xs text-textSecondary">
          {context.matchId && <label className="flex items-start gap-2"><input type="checkbox" checked={saveMatch} onChange={event => { setSaveMatch(event.target.checked); setDirty(true); onReady(false); }} />Ook gebruiken voor andere clips van deze wedstrijd zonder eigen intro-instelling</label>}
          {context.teamId && <label className="flex items-start gap-2"><input type="checkbox" checked={saveTeam} onChange={event => { setSaveTeam(event.target.checked); setDirty(true); onReady(false); }} />Aan/uit en duur als ploegstandaard bewaren (gewone wedstrijdkaart)</label>}
        </div>}
        {dirty && <button type="button" onClick={() => void save()} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page">{busy ? "Bezig…" : "Intro-instelling bewaren"}</button>}
      </fieldset>
      {!dirty && !busy && <p className="mt-2 text-xs text-textMuted">{settings.enabled ? "Dit introbeeld wordt getoond bij het openen van de clip." : "Deze clip speelt zonder introbeeld."}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </>}
  </div>;
}
