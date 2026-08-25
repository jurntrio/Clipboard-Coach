"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = { email: string; full_name: string | null } | null;
type Membership = { profile_id: string; role: string; function_role: string | null; created_at: string; profiles: Profile };
type Team = { id: string; name: string; age_category: string | null; level_or_competition: string | null; created_at: string; profiles: Profile };
type Claim = { id: string; reason: string; created_at: string; profiles: Profile; people: { first_name: string; last_name: string } | null };
type Registration = { id: string; profile_id: string; request_kind: "staff" | "contact"; requested_function_role: string | null; requested_custom_role: string | null; requested_team_id: string | null; player_first_name: string | null; player_last_name: string | null; player_date_of_birth: string | null; created_at: string; profiles: Profile };
type Player = { id: string; first_name: string; last_name: string; date_of_birth: string | null };
type ApprovalData = { memberships: Membership[]; teams: Team[]; claims: Claim[]; registrations: Registration[]; players: Player[]; activeTeams: Team[] };

const functions = [["trainer","Trainer"],["assistant_trainer","Assistent-trainer"],["team_manager","Teammanager"],["doctor","Dokter"],["physiotherapist","Kinesist"],["video_analyst","Videoanalist"],["youth_coordinator","Jeugdcoördinator"],["scout","Scout"],["custom","Andere functie"]];

export function ClubApprovals() {
  const router = useRouter();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState<Record<string, { functionRole: string; customRoleName: string; teamIds: string[]; clubPlayerId: string }>>({});

  async function load() {
    const response = await fetch("/api/club/approvals", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Aanvragen konden niet geladen worden.");
    setData(body);
  }
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, []);

  async function decide(type: "membership" | "team" | "claim", id: string, decision: "approved" | "rejected") {
    setBusy(`${type}:${id}`); setError("");
    const response = type === "team"
      ? await fetch("/api/club/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: id, status: decision === "approved" ? "active" : "rejected" }) })
      : await fetch("/api/club/approvals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, decision }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error || "De aanvraag kon niet beoordeeld worden.");
    else { await load(); window.dispatchEvent(new Event("dashboard-badges:refresh")); router.refresh(); }
    setBusy("");
  }

  async function decideRegistration(item: Registration, decision: "approved" | "rejected") {
    const draft = decisions[item.id] ?? { functionRole: item.requested_function_role ?? "", customRoleName: item.requested_custom_role ?? "", teamIds: item.requested_team_id ? [item.requested_team_id] : [], clubPlayerId: "" };
    setBusy(`registration:${item.id}`); setError("");
    const response = await fetch("/api/club/approvals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "registration", id: item.id, decision, ...draft }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error || "De aanvraag kon niet beoordeeld worden.");
    else { await load(); window.dispatchEvent(new Event("dashboard-badges:refresh")); router.refresh(); }
    setBusy("");
  }

  if (error && !data) return <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>;
  if (!data) return <p className="text-textMuted">Aanvragen laden…</p>;
  const total = data.memberships.length + data.teams.length + data.claims.length + data.registrations.length;
  return <div className="mt-6 space-y-6">
    {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}
    {!total && <div className="rounded-xl border border-dashed border-border p-10 text-center"><h2 className="font-semibold text-textBright">Alles is behandeld</h2><p className="mt-2 text-sm text-textMuted">Er zijn geen openstaande club-, team- of persoonsaanvragen.</p></div>}
    {!!data.registrations.length && <ApprovalSection title="Nieuwe registratieaanvragen" description="Kies bij goedkeuring de definitieve functie en eventuele teams, of koppel een contactpersoon aan de juiste speler.">{data.registrations.map(item => {
      const draft = decisions[item.id] ?? { functionRole: item.requested_function_role ?? "", customRoleName: item.requested_custom_role ?? "", teamIds: item.requested_team_id ? [item.requested_team_id] : [], clubPlayerId: "" };
      const update = (patch: Partial<typeof draft>) => setDecisions(current => ({ ...current, [item.id]: { ...draft, ...patch } }));
      const matchingPlayers = data.players.filter(player => player.date_of_birth === item.player_date_of_birth);
      return <article key={item.id} className="rounded-lg border border-borderSubtle bg-cardDeep p-4"><div className="flex flex-wrap justify-between gap-2"><div><strong className="text-textPrimary">{profileName(item.profiles)}</strong><p className="mt-1 text-xs text-textMuted">{item.request_kind === "contact" ? `Contactpersoon voor ${item.player_first_name} ${item.player_last_name} · ${item.player_date_of_birth}` : `Aangevraagd: ${item.requested_custom_role || item.requested_function_role || "geen functie gekozen"}`} · {formatDate(item.created_at)}</p></div></div>
        {item.request_kind === "staff" ? <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs text-textMuted">Definitieve functie<select value={draft.functionRole} onChange={event => update({ functionRole: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"><option value="">Kies een functie…</option>{functions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>{draft.functionRole === "custom" && <label className="text-xs text-textMuted">Naam van de functie<input value={draft.customRoleName} onChange={event => update({ customRoleName: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /></label>}<fieldset className="md:col-span-2"><legend className="text-xs text-textMuted">Teams indien nodig</legend><div className="mt-1 flex flex-wrap gap-2">{data.activeTeams.map(team => <label key={team.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-textPrimary"><input type="checkbox" checked={draft.teamIds.includes(team.id)} onChange={() => update({ teamIds: draft.teamIds.includes(team.id) ? draft.teamIds.filter(id => id !== team.id) : [...draft.teamIds, team.id] })}/>{team.name}</label>)}</div></fieldset></div> : <label className="mt-3 block text-xs text-textMuted">Koppel aan speler<select value={draft.clubPlayerId} onChange={event => update({ clubPlayerId: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"><option value="">Kies de juiste speler…</option>{matchingPlayers.map(player => <option key={player.id} value={player.id}>{player.first_name} {player.last_name} · {player.date_of_birth}</option>)}</select></label>}
        <div className="mt-4 flex gap-2"><button disabled={busy === `registration:${item.id}`} onClick={() => void decideRegistration(item,"approved")} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-50">Goedkeuren</button><button disabled={busy === `registration:${item.id}`} onClick={() => void decideRegistration(item,"rejected")} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">Afwijzen</button></div></article>;
    })}</ApprovalSection>}
    {!!data.memberships.length && <ApprovalSection title="Clublidmaatschappen" description="Personen die toegang tot deze club aanvragen.">{data.memberships.map(item => <ApprovalCard key={item.profile_id} title={profileName(item.profiles)} details={`${item.function_role || item.role} · ${formatDate(item.created_at)}`} busy={busy === `membership:${item.profile_id}`} onDecision={decision => decide("membership", item.profile_id, decision)} />)}</ApprovalSection>}
    {!!data.teams.length && <ApprovalSection title="Aangevraagde nieuwe ploegen" description="Ploegen die werden voorgesteld door iemand die nog toegang tot deze club aanvraagt. Ploegen die een clubadmin zelf aanmaakt, horen automatisch bij de club.">{data.teams.map(item => <ApprovalCard key={item.id} title={item.name} details={`${[item.age_category, item.level_or_competition].filter(Boolean).join(" · ") || "Geen extra ploeggegevens"} · aangevraagd door ${profileName(item.profiles)} · ${formatDate(item.created_at)}`} busy={busy === `team:${item.id}`} onDecision={decision => decide("team", item.id, decision)} />)}</ApprovalSection>}
    {!!data.claims.length && <ApprovalSection title="Persoonskoppelingen" description="Accounts die vragen om aan een bestaande persoon gekoppeld te worden.">{data.claims.map(item => <ApprovalCard key={item.id} title={`${item.people?.first_name ?? ""} ${item.people?.last_name ?? ""}`.trim() || "Onbekende persoon"} details={`${profileName(item.profiles)} · ${item.reason} · ${formatDate(item.created_at)}`} busy={busy === `claim:${item.id}`} onDecision={decision => decide("claim", item.id, decision)} />)}</ApprovalSection>}
  </div>;
}

function ApprovalSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-bold text-textBright">{title}</h2><p className="mt-1 text-sm text-textMuted">{description}</p><div className="mt-4 space-y-3">{children}</div></section>;
}
function ApprovalCard({ title, details, busy, onDecision }: { title: string; details: string; busy: boolean; onDecision: (decision: "approved" | "rejected") => void }) {
  return <article className="flex flex-col gap-3 rounded-lg border border-borderSubtle bg-cardDeep p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><strong className="text-textPrimary">{title}</strong><p className="mt-1 text-xs text-textMuted">{details}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => onDecision("approved")} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-50">Goedkeuren</button><button disabled={busy} onClick={() => onDecision("rejected")} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">Afwijzen</button></div></article>;
}
function profileName(profile: Profile) { return profile?.full_name?.trim() || profile?.email || "Onbekende gebruiker"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
