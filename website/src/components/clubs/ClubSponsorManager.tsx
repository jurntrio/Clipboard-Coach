"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type SponsorTarget =
  | { kind: "general"; id: string; name: string; url: string | null; enabled: boolean }
  | { kind: "team"; id: string; name: string; url: string | null; enabled: boolean };

export function ClubSponsorManager({ clubId, generalUrl, useGeneral, teams, readOnly, onChanged }: {
  clubId: string;
  generalUrl: string | null;
  useGeneral: boolean;
  teams: { id: string; name: string; sponsor_url?: string | null; sponsor_enabled?: boolean }[];
  readOnly: boolean;
  onChanged: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<SponsorTarget | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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

  const SponsorPreview = ({ url, name }: { url: string | null; name: string }) => (
    <div className="grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1">
      {url
        ? <Image src={url} alt={`Sponsor ${name}`} width={112} height={64} unoptimized className="h-full w-full object-contain" />
        : <span className="text-center text-[10px] font-bold uppercase text-[#7a857f]">Geen sponsor</span>}
    </div>
  );

  return <div className="mt-4 space-y-4">
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
      onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} />
    <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textPrimary">Algemene sponsor</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SponsorPreview url={generalUrl} name="algemeen" />
        <button type="button" disabled={readOnly || !!busy}
          onClick={() => chooseUpload({ kind: "general", id: clubId, name: "Algemeen", url: generalUrl, enabled: useGeneral })}
          className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary disabled:opacity-50">
          {generalUrl ? "Afbeelding vervangen" : "Afbeelding uploaden"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-textPrimary">
          <input type="checkbox" checked={useGeneral} disabled={readOnly || !!busy}
            onChange={event => void save({ useGeneralSponsor: event.target.checked }, "general-toggle")}
            className="h-5 w-5 accent-accent disabled:opacity-50" />
          Gebruik voor alle video’s
        </label>
      </div>
      <p className="mt-2 text-xs text-textMuted">Hoofdinstelling: wanneer dit aanstaat wordt deze sponsor standaard geselecteerd voor wedstrijden. Uitschakelen verwijdert de algemene sponsor ook uit de wedstrijdinstellingen; individuele ploegsponsors blijven bewaard.</p>
    </div>
    <div className={`rounded-xl border border-borderSubtle bg-cardDeep p-4 ${useGeneral ? "opacity-55" : ""}`}>
      <h3 className="font-semibold text-textPrimary">Sponsors per ploeg</h3>
      <div className="mt-3 space-y-2">
        {teams.map(team => {
          const enabled = team.sponsor_enabled === true;
          const url = team.sponsor_url ?? null;
          return <div key={team.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
            <SponsorPreview url={url} name={team.name} />
            <strong className="min-w-40 flex-1 text-sm text-textPrimary">{team.name}</strong>
            <button type="button" disabled={readOnly || useGeneral || !!busy}
              onClick={() => chooseUpload({ kind: "team", id: team.id, name: team.name, url, enabled })}
              className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary disabled:opacity-50">
              {url ? "Vervangen" : "Uploaden"}
            </button>
            <label className="flex items-center gap-2 text-sm text-textPrimary">
              <input type="checkbox" checked={enabled} disabled={readOnly || useGeneral || !url || !!busy}
                onChange={event => void save({ teamSponsor: { teamId: team.id, enabled: event.target.checked } }, `team-toggle:${team.id}`)}
                className="h-5 w-5 accent-accent disabled:opacity-50" />
              Actief
            </label>
          </div>;
        })}
      </div>
    </div>
    {error && <p className="text-sm text-red-300">{error}</p>}
  </div>;
}
