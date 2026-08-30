"use client";

import { useMemo, useState } from "react";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";

type Team = { id: string; name: string; players: { id: string; name: string }[] };

export function ClubInvitationCreator({ clubId, teams, readOnly, compact = false }: { clubId: string; teams: Team[]; readOnly: boolean; compact?: boolean }) {
  const [functionRole, setFunctionRole] = useState("trainer");
  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [expectedName, setExpectedName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const isGuardian = functionRole === "guardian";
  const isClubWideAdmin = functionRole === "club_admin" || functionRole === "club_admin_viewer";
  const players = useMemo(() => teams.find((team) => team.id === teamId)?.players ?? [], [teams, teamId]);

  async function createInvite() {
    setStatus("Uitnodiging maken…");
    setLink("");
    const response = await fetch(isGuardian ? `/api/players/${playerId}/invite` : "/api/club-invitations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isGuardian
        ? { contactLabel: expectedName, contactEmail, contactPhone }
        : { clubId, teamId, functionRole, expectedName, contactEmail })
    });
    const body = await response.json();
    if (!response.ok) return setStatus(body.error || "Uitnodiging kon niet worden gemaakt.");
    setLink(`${window.location.origin}/${isGuardian ? "join" : "club-invite"}/${body.token}`);
    setStatus(body.emailSent ? "Uitnodigingsmail verzonden." : contactEmail ? `Link aangemaakt, maar e-mail niet verzonden${body.deliveryError ? `: ${body.deliveryError}` : "."}` : "Uitnodiging klaar. De link kan één keer worden gebruikt.");
  }

  if (readOnly) return null;
  const content = <>
    <h2 className="text-xl font-semibold text-textBright">Iemand uitnodigen</h2>
    <p className="mt-1 text-sm text-textMuted">Kies vooraf de rol. Als je een naam invult, moet de persoon zich met exact die naam registreren. De link vervalt na één registratie.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm text-textSecondary">Rol<select value={functionRole} onChange={(event) => { setFunctionRole(event.target.value); setTeamId(""); setPlayerId(""); }} className={inputClass}><option value="guardian">Verantwoordelijke van speler</option>{CLUB_FUNCTION_ROLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm text-textSecondary">{isGuardian ? "Naam/relatie (optioneel)" : "Verwachte volledige naam (optioneel)"}<input value={expectedName} onChange={(event) => setExpectedName(event.target.value)} placeholder={isGuardian ? "Bijvoorbeeld mama, papa of voogd" : "Bijvoorbeeld Bart De Loof"} className={inputClass} /></label>
      {!isClubWideAdmin && <label className="text-sm text-textSecondary">Ploeg<select required value={teamId} onChange={(event) => { setTeamId(event.target.value); setPlayerId(""); }} className={inputClass}><option value="">Kies een ploeg</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
      {isClubWideAdmin && <div className="rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-sm text-textSecondary"><span className="font-semibold text-textPrimary">Toegang:</span> alle ploegen van de club</div>}
      <label className="text-sm text-textSecondary">E-mail (voor rechtstreekse verzending)<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="naam@voorbeeld.be" className={inputClass} /></label>
      {isGuardian && <label className="text-sm text-textSecondary">Speler<select required value={playerId} disabled={!teamId} onChange={(event) => setPlayerId(event.target.value)} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}><option value="">Kies een speler</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>}
      {isGuardian && <label className="text-sm text-textSecondary">Gsm-nummer (optioneel)<input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+32…" className={inputClass} /></label>}
    </div>
    <button type="button" disabled={(!isClubWideAdmin && !teamId) || (isGuardian && !playerId)} onClick={() => void createInvite()} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">Uitnodiging aanmaken</button>
    {status && <p className="mt-3 text-sm text-accent">{status}</p>}
    {link && <div className="mt-3 flex gap-2 rounded-lg border border-borderSubtle bg-cardDeep p-2"><input readOnly value={link} className="min-w-0 flex-1 bg-transparent px-2 text-xs text-textPrimary" /><button type="button" onClick={() => void navigator.clipboard.writeText(link)} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-accent">Link kopiëren</button></div>}
  </>;
  if (compact) return <details className="group/invite rounded-lg border border-border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-textPrimary">
      Iemand uitnodigen <span className="text-accent transition-transform group-open/invite:rotate-90">▶</span>
    </summary>
    <div className="border-t border-borderSubtle p-4">{content}</div>
  </details>;
  return <section className="rounded-xl border border-border bg-card p-5">{content}</section>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
