"use client";
import { useEffect, useState } from "react";

export function TeamClipImagesToggle({ teamId, readOnly }: { teamId: string; readOnly?: boolean }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setAllowed(null); setError("");
    fetch(`/api/club/teams/${teamId}/clip-images`, { cache: "no-store" }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      if (active) setAllowed(body.allowed);
    }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [teamId, attempt]);
  async function save(next: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/club/teams/${teamId}/clip-images`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowed: next }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setAllowed(body.allowed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bewaren mislukt."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 rounded-lg border border-borderSubtle bg-card p-3">
    <label className="flex items-center gap-3 text-sm font-semibold text-textPrimary"><input type="checkbox" checked={allowed === true} disabled={allowed === null || busy || readOnly} onChange={event => void save(event.target.checked)} />Introbeelden bij clips toestaan</label>
    <p className="mt-1 text-xs text-textMuted">Maakt in ‘Clip maken’ een optioneel openingsbeeld en beelden vóór afzonderlijke tags beschikbaar. Een beeld is nooit verplicht. Deze instelling wordt meteen bewaard.</p>
    <p role="status" className="mt-1 text-xs text-accent">{busy ? "Bewaren…" : allowed === null ? "Instelling laden…" : allowed ? "Toegestaan voor nieuwe clips" : "Uit voor nieuwe clips"}</p>
    {error && <p role="alert" className="mt-1 text-xs text-red-300">{error} <button type="button" className="underline" onClick={() => setAttempt(value => value + 1)}>Opnieuw laden</button></p>}
  </div>;
}
