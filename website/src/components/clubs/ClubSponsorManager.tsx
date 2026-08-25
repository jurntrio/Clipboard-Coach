"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type SponsorSource = "team" | "club" | "none";
type SponsorTarget =
  | { kind: "general"; id: string; name: string }
  | { kind: "team"; id: string; name: string };
type TeamSponsor = {
  id: string;
  name: string;
  sponsor_url?: string | null;
  sponsor_enabled?: boolean;
  sponsor_source?: SponsorSource;
};

export function ClubSponsorManager({ clubId, generalUrl, teams, readOnly, onChanged }: {
  clubId: string;
  generalUrl: string | null;
  teams: TeamSponsor[];
  readOnly: boolean;
  onChanged: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<SponsorTarget | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sources, setSources] = useState<Record<string, SponsorSource>>(() => sourcesFromTeams(teams));

  useEffect(() => setSources(sourcesFromTeams(teams)), [teams]);

  const distribution = distributionFromSources(teams, sources);

  async function save(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/club/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, ...payload })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Sponsorinstelling kon niet worden bewaard.");
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sponsorinstelling kon niet worden bewaard.");
    } finally {
      setBusy("");
    }
  }

  function chooseUpload(next: SponsorTarget) {
    setTarget(next);
    inputRef.current?.click();
  }

  async function upload(file: File) {
    if (!target) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Kies een PNG-, JPEG- of WebP-afbeelding.");
    if (file.size > 8 * 1024 * 1024) return setError("Een sponsorafbeelding mag maximaal 8 MB groot zijn.");
    const key = `sponsor-upload:${target.kind}:${target.id}`;
    setBusy(key);
    setError("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const objectKey = `clubs/${clubId}/sponsors/${target.kind}-${target.id}-${crypto.randomUUID()}.${extension}`;
      const prepare = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: objectKey, contentType: file.type })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Upload kon niet worden voorbereid.");
      const put = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`Upload mislukt (HTTP ${put.status}).`);
      await save(target.kind === "general"
        ? { generalSponsorUrl: prepared.publicUrl }
        : { teamSponsor: { teamId: target.id, sponsorUrl: prepared.publicUrl } }, key);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sponsorafbeelding kon niet worden geüpload.");
      setBusy("");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className="space-y-4">
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
      onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} />

    <section className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textPrimary">Algemene sponsor</h3>
      <p className="mt-1 text-xs text-textMuted">Deze afbeelding kan als standaard voor alle ploegen worden gebruikt.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SponsorPreview url={generalUrl} name="algemeen" />
        <button type="button" disabled={readOnly || !!busy}
          onClick={() => chooseUpload({ kind: "general", id: clubId, name: "Algemeen" })}
          className={secondaryButton}>
          {generalUrl ? "Afbeelding vervangen" : "Afbeelding uploaden"}
        </button>
      </div>
    </section>

    <section className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-textPrimary">Sponsorverdeling</h3>
        <span className="group/info relative grid h-5 w-5 cursor-help place-items-center rounded-full border border-borderButton text-xs font-bold text-accent" tabIndex={0} aria-label="Informatie over sponsorverdeling">
          i
          <span role="tooltip" className="pointer-events-none absolute left-0 top-7 z-20 hidden w-72 rounded-lg border border-borderSubtle bg-card p-3 text-xs font-normal leading-relaxed text-textSecondary shadow-xl group-hover/info:block group-focus/info:block">
            Een bulkkeuze overschrijft alle individuele ploegkeuzes. Je kunt daarna opnieuw uitzonderingen instellen.
          </span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={readOnly || !!busy}
          onClick={() => { setSources(allSources(teams, "club")); void save({ bulkTeamSponsorSource: "club" }, "bulk:club"); }}
          className={distribution === "club" ? primaryButton : secondaryButton}>Algemene sponsor</button>
        <button type="button" disabled={readOnly || !!busy}
          onClick={() => { setSources(allSources(teams, "team")); void save({ bulkTeamSponsorSource: "team" }, "bulk:team"); }}
          className={distribution === "team" ? primaryButton : secondaryButton}>Teamsponsor</button>
        <button type="button" disabled={readOnly || !!busy}
          onClick={() => { setSources(allSources(teams, "none")); void save({ bulkTeamSponsorSource: "none" }, "bulk:none"); }}
          className={distribution === "none" ? primaryButton : dangerButton}>Geen sponsor</button>
        <button type="button" disabled className={distribution === "individual" ? primaryButton : disabledButton}>Individueel</button>
      </div>
      {busy.startsWith("bulk:") && <p className="mt-2 text-xs text-textMuted">Alle ploegkeuzes worden bijgewerkt…</p>}
    </section>

    <details className="group rounded-xl border border-borderSubtle bg-cardDeep">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="min-w-0 flex-1">
          <strong className="block text-textPrimary">Sponsors per ploeg</strong>
          <span className="mt-1 block text-xs text-textMuted">{teamSummary(teams, sources)}</span>
        </span>
        <span className="text-accent transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="border-t border-borderSubtle p-4">
        <div className="hidden grid-cols-[minmax(180px,1fr)_112px_minmax(310px,auto)] gap-3 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-textMuted md:grid">
          <span>Ploeg</span><span>Teamsponsor</span><span>Getoonde sponsor</span>
        </div>
        <div className="space-y-2">{teams.map(team => {
          const source = sources[team.id] ?? team.sponsor_source ?? (team.sponsor_enabled ? "team" : "club");
          const url = team.sponsor_url ?? null;
          return <div key={team.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[minmax(180px,1fr)_112px_minmax(310px,auto)] md:items-center">
            <div>
              <strong className="block text-sm text-textPrimary">{team.name}</strong>
              <button type="button" disabled={readOnly || !!busy}
                onClick={() => chooseUpload({ kind: "team", id: team.id, name: team.name })}
                className="mt-2 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50">
                {url ? "Sponsor vervangen" : "Sponsor uploaden"}
              </button>
            </div>
            <SponsorPreview url={url} name={team.name} compact />
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-borderButton">
              <SourceButton label="Algemeen" selected={source === "club"} disabled={readOnly || !!busy}
                onClick={() => { setSources(current => ({ ...current, [team.id]: "club" })); void save({ teamSponsor: { teamId: team.id, source: "club" } }, `source:${team.id}`); }} />
              <SourceButton label="Teamsponsor" selected={source === "team"} disabled={readOnly || !!busy}
                onClick={() => { setSources(current => ({ ...current, [team.id]: "team" })); void save({ teamSponsor: { teamId: team.id, source: "team" } }, `source:${team.id}`); }} />
              <SourceButton label="Geen" selected={source === "none"} disabled={readOnly || !!busy}
                onClick={() => { setSources(current => ({ ...current, [team.id]: "none" })); void save({ teamSponsor: { teamId: team.id, source: "none" } }, `source:${team.id}`); }} />
            </div>
            {source === "team" && !url && <p className="text-xs italic text-amber-300 md:col-start-3">Geen teamsponsor geüpload; voor deze ploeg wordt niets getoond.</p>}
          </div>;
        })}</div>
      </div>
    </details>

    <section className="rounded-xl border border-dashed border-borderSubtle bg-cardDeep/50 p-4">
      <h3 className="font-semibold text-textMuted">Gepland</h3>
      <div className="mt-2 grid gap-2 text-sm italic text-textMuted sm:grid-cols-2">
        <p>Matchsponsor per afzonderlijke wedstrijd — binnenkort</p>
        <p>Sponsorblok van 3, 5 of 8 seconden vóór een clip — binnenkort</p>
        <p>Sponsor tonen bij specifieke tags zoals Goal of Highlight — binnenkort</p>
        <p>Sponsor permanent verwerken in een video-export — later</p>
        <p>Campagnes automatisch starten en stoppen op datum — binnenkort</p>
        <p>Sponsorweergaven en doorklikken meten — later</p>
      </div>
    </section>

    {error && <p className="text-sm text-red-300">{error}</p>}
  </div>;
}

function SponsorPreview({ url, name, compact = false }: { url: string | null; name: string; compact?: boolean }) {
  return <div className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1 ${compact ? "h-12 w-20" : "h-16 w-28"}`}>
    {url
      ? <Image src={url} alt={`Sponsor ${name}`} width={112} height={64} unoptimized className="h-full w-full object-contain" />
      : <span className="text-center text-[9px] font-bold uppercase text-[#7a857f]">Geen sponsor</span>}
  </div>;
}

function SourceButton({ label, selected, disabled, onClick }: {
  label: string; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className={`px-2 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "bg-accent text-page" : "bg-button text-textSecondary hover:text-textPrimary"}`}>
    {label}
  </button>;
}

function teamSummary(teams: TeamSponsor[], sources: Record<string, SponsorSource>) {
  const counts = { team: 0, club: 0, none: 0 };
  for (const team of teams) counts[sources[team.id] ?? team.sponsor_source ?? (team.sponsor_enabled ? "team" : "club")] += 1;
  return `${counts.team} teamsponsor · ${counts.club} algemeen · ${counts.none} geen sponsor`;
}

function sourcesFromTeams(teams: TeamSponsor[]) {
  return Object.fromEntries(teams.map(team => [team.id, team.sponsor_source ?? (team.sponsor_enabled ? "team" : "club")])) as Record<string, SponsorSource>;
}

function allSources(teams: TeamSponsor[], source: SponsorSource) {
  return Object.fromEntries(teams.map(team => [team.id, source])) as Record<string, SponsorSource>;
}

function distributionFromSources(teams: TeamSponsor[], sources: Record<string, SponsorSource>): SponsorSource | "individual" {
  const selected = new Set(teams.map(team => sources[team.id] ?? team.sponsor_source ?? (team.sponsor_enabled ? "team" : "club")));
  return selected.size === 1 ? [...selected][0] : "individual";
}

const primaryButton = "rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton = "rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-50";
const disabledButton = "rounded-lg border border-borderSubtle px-3 py-2 text-sm font-semibold text-textMuted opacity-60";
