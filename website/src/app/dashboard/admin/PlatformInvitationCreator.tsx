"use client";

import { useMemo, useState } from "react";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";

type Club = { id: string; name: string; teams: { id: string; name: string; players: { id: string; name: string }[] }[] };

export function PlatformInvitationCreator({ clubs }: { clubs: Club[] }) {
  const [kind, setKind] = useState("platform_admin");
  const [clubId, setClubId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [expectedName, setExpectedName] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const isPlatformRole = kind === "platform_admin" || kind === "admin_viewer";
  const isGuardian = kind === "guardian";
  const teams = useMemo(() => clubs.find((club) => club.id === clubId)?.teams ?? [], [clubs, clubId]);
  const players = useMemo(() => teams.find((team) => team.id === teamId)?.players ?? [], [teams, teamId]);

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setStatus("Uitnodiging maken…"); setLink("");
    const response = await fetch(isGuardian ? `/api/players/${playerId}/invite` : "/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isGuardian ? { contactLabel: expectedName, contactPhone } : {
        accountRole: isPlatformRole ? kind : "club_member",
        functionRole: isPlatformRole ? null : kind,
        clubId: isPlatformRole ? null : clubId,
        teamId: isPlatformRole ? null : teamId,
        expectedName, customRoleName, contactEmail, contactPhone
      })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setStatus(body.error || "Uitnodiging kon niet worden gemaakt.");
    setLink(`${window.location.origin}/${isGuardian ? "join" : "club-invite"}/${body.token}`);
    setStatus("Uitnodiging klaar. De link kan één keer worden gebruikt.");
  }

  return <section className="mt-8 rounded-xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold text-textBright">Iemand uitnodigen</h2>
    <p className="mt-1 text-sm text-textMuted">Maak als Platform Admin een eenmalige registratielink. Voor clubfuncties worden club en ploeg automatisch gekoppeld.</p>
    <form onSubmit={createInvite} className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-textSecondary">Rol of functie
          <select value={kind} onChange={(event) => { setKind(event.target.value); setClubId(""); setTeamId(""); }} className={inputClass}>
            <option value="platform_admin">Admin</option>
            <option value="admin_viewer">Admin (viewer)</option>
            <option value="guardian">Verantwoordelijke van speler</option>
            <optgroup label="Clubfuncties">
              {CLUB_FUNCTION_ROLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="text-sm text-textSecondary">{isGuardian ? "Naam/relatie" : "Volledige naam"}
          <input required value={expectedName} onChange={(event) => setExpectedName(event.target.value)} placeholder="Bijvoorbeeld Bart De Loof" className={inputClass} />
        </label>
      </div>
      {!isPlatformRole && <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-textSecondary">Club
          <select required value={clubId} onChange={(event) => { setClubId(event.target.value); setTeamId(""); setPlayerId(""); }} className={inputClass}>
            <option value="">Kies een club</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-textSecondary">Ploeg
          <select required value={teamId} disabled={!clubId} onChange={(event) => { setTeamId(event.target.value); setPlayerId(""); }} className={`${inputClass} disabled:opacity-50`}>
            <option value="">Kies een ploeg</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      </div>}
      {isGuardian && <label className="block text-sm text-textSecondary">Speler
        <select required value={playerId} disabled={!teamId} onChange={(event) => setPlayerId(event.target.value)} className={`${inputClass} disabled:opacity-50`}>
          <option value="">Kies een speler</option>
          {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
      </label>}
      {kind === "custom" && <label className="block text-sm text-textSecondary">Naam aangepaste clubfunctie
        <input required value={customRoleName} onChange={(event) => setCustomRoleName(event.target.value)} placeholder="Bijvoorbeeld Materiaalverantwoordelijke U14" className={inputClass} />
      </label>}
      <div className="grid gap-3 md:grid-cols-2">
        {!isGuardian && <label className="text-sm text-textSecondary">E-mail (optioneel)
          <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="naam@voorbeeld.be" className={inputClass} />
        </label>}
        <label className="text-sm text-textSecondary">Gsm-nummer (optioneel)
          <input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+32…" className={inputClass} />
        </label>
      </div>
      <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:opacity-50">{busy ? "Aanmaken…" : "Uitnodiging aanmaken"}</button>
    </form>
    {status && <p className="mt-3 text-sm text-accent">{status}</p>}
    {link && <div className="mt-3 flex gap-2 rounded-lg border border-borderSubtle bg-cardDeep p-2">
      <input readOnly value={link} className="min-w-0 flex-1 bg-transparent px-2 text-xs text-textPrimary" />
      <button type="button" onClick={() => void navigator.clipboard.writeText(link)} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-accent">Link kopiëren</button>
    </div>}
  </section>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
