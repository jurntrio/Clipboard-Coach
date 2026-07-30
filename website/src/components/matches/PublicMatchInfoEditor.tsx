"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MatchPublicInfo = {
  id: string; score_a: number | null; score_b: number | null;
  public_location: string | null; show_public_location: boolean;
  sponsor_source: "none" | "club" | "team"; sponsor_caption: string | null;
};

export function PublicMatchInfoEditor({ match, sponsorFeatureEnabled, hasClubSponsor, hasTeamSponsor }: {
  match: MatchPublicInfo; sponsorFeatureEnabled: boolean; hasClubSponsor: boolean; hasTeamSponsor: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scoreA, setScoreA] = useState(match.score_a?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.score_b?.toString() ?? "");
  const [location, setLocation] = useState(match.public_location ?? "");
  const [showLocation, setShowLocation] = useState(match.show_public_location === true);
  const [sponsorSource, setSponsorSource] = useState(match.sponsor_source ?? "none");
  const [sponsorEnabled, setSponsorEnabled] = useState(match.sponsor_source !== "none");
  const [sponsorCaption, setSponsorCaption] = useState(match.sponsor_caption ?? "");
  const [status, setStatus] = useState("");

  async function save() {
    setStatus("Bewaren…");
    const response = await fetch(`/api/matches/${match.id}/public-info`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreA, scoreB, location, showLocation, sponsorSource: sponsorEnabled ? sponsorSource : "none", sponsorCaption })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return setStatus(body?.error || "Kon niet worden bewaard.");
    setStatus("Bewaard");
    router.refresh();
  }

  return <section className="rounded-2xl border border-border bg-card p-5 sm:col-span-2">
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
      <span><strong className="block text-textBright">Publieke wedstrijdinformatie</strong><span className="mt-1 block text-xs text-textMuted">Zichtbaar op gedeelde cliplinks. Alleen voor bevoegde clubrollen.</span></span>
      <span className="text-accent">{open ? "▲" : "▼"}</span>
    </button>
    {open && <div className="mt-5 space-y-5 border-t border-borderSubtle pt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-textSecondary">Score thuis<input type="number" min="0" value={scoreA} onChange={(event) => setScoreA(event.target.value)} className={inputClass} /></label>
        <label className="text-sm text-textSecondary">Score uit<input type="number" min="0" value={scoreB} onChange={(event) => setScoreB(event.target.value)} className={inputClass} /></label>
      </div>
      <div>
        <label className="text-sm text-textSecondary">Locatie<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Bijvoorbeeld: De Velodroom, Torhout" className={inputClass} /></label>
        <label className="mt-3 flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={showLocation} onChange={(event) => setShowLocation(event.target.checked)} className="h-4 w-4 accent-accent" />Locatie tonen op gedeelde links</label>
        <p className="mt-1 text-xs text-textMuted">Staat standaard uit.</p>
      </div>
      {sponsorFeatureEnabled ? <div>
        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-textPrimary"><input type="checkbox" checked={sponsorEnabled} onChange={(event) => {
          const enabled = event.target.checked;
          setSponsorEnabled(enabled);
          if (enabled && sponsorSource === "none") setSponsorSource(hasClubSponsor ? "club" : hasTeamSponsor ? "team" : "none");
        }} disabled={!hasClubSponsor && !hasTeamSponsor} className="h-4 w-4 accent-accent" />Sponsor tonen op gedeelde clips van deze wedstrijd</label>
        <label className="text-sm text-textSecondary">Sponsor voor deze wedstrijd
          <select value={sponsorSource === "none" ? (hasClubSponsor ? "club" : hasTeamSponsor ? "team" : "none") : sponsorSource} onChange={(event) => setSponsorSource(event.target.value as typeof sponsorSource)} disabled={!sponsorEnabled} className={inputClass}>
            {!hasClubSponsor && !hasTeamSponsor && <option value="none">Geen sponsor ingesteld</option>}
            <option value="club" disabled={!hasClubSponsor}>Algemene clubsponsor{!hasClubSponsor ? " — niet ingesteld" : ""}</option>
            <option value="team" disabled={!hasTeamSponsor}>Ploegsponsor{!hasTeamSponsor ? " — niet ingesteld" : ""}</option>
          </select>
        </label>
        <label className="mt-3 block text-sm text-textSecondary">Sponsortekst<input value={sponsorCaption} onChange={(event) => setSponsorCaption(event.target.value)} placeholder="Wedstrijdbeelden mogelijk gemaakt door …" className={inputClass} /></label>
      </div> : <p className="rounded-lg border border-borderSubtle bg-cardDeep p-3 text-sm text-textMuted">De extra sponsormodule is voor deze club niet actief.</p>}
      <div className="flex items-center gap-3"><button type="button" onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page">Bewaren</button><span className="text-sm text-textMuted">{status}</span></div>
    </div>}
  </section>;
}

const inputClass = "mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-textPrimary";
