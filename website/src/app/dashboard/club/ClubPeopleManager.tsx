"use client";

import { useEffect, useMemo, useState } from "react";

type Team = { id: string; name: string };
type Account = {
  id: string; profile_id: string; status: string; link_method: string; verified_at: string | null;
  profiles: { email: string } | null;
};
type Role = {
  id: string; role_type: string; club_team_id: string | null; valid_from: string;
  valid_until: string | null; status: string; club_teams: { name: string } | null;
};
type Invitation = {
  id: string; intended_email: string | null; status: string; expires_at: string; created_at: string;
};
type Person = {
  id: string; personId: string; firstName: string; lastName: string; dateOfBirth: string | null;
  status: string; personStatus: string; externalMemberId: string | null;
  accounts: Account[]; roles: Role[]; invitations: Invitation[];
};
type Claim = {
  id: string; requested_profile_id: string; candidate_person_id: string | null; reason: string;
  evidence: Record<string, unknown>; created_at: string;
  profiles: { email: string; full_name: string | null } | null;
  people: { first_name: string; last_name: string; date_of_birth: string | null } | null;
};

const roleOptions = [
  ["trainer", "Trainer"],
  ["assistant_trainer", "Assistent-trainer"],
  ["goalkeeper_coach", "Keeperstrainer"],
  ["team_manager", "Afgevaardigde"],
  ["scout", "Scout"],
  ["hospitality_worker", "Hospitality"],
  ["volunteer", "Vrijwilliger"],
  ["board_member", "Bestuurslid"],
  ["club_employee", "Clubmedewerker"],
  ["physiotherapist", "Kinesist"], ["doctor", "Dokter"]
] as const;
const roleLabels = Object.fromEntries(roleOptions);

export function ClubPeopleManager({ clubId, teams, readOnly }: {
  clubId: string; teams: Team[]; readOnly: boolean;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const [peopleResponse, claimsResponse] = await Promise.all([
      fetch(`/api/club/people?clubId=${encodeURIComponent(clubId)}`),
      readOnly ? Promise.resolve(null) : fetch(`/api/club/person-claims?clubId=${encodeURIComponent(clubId)}`)
    ]);
    const peopleBody = await peopleResponse.json();
    if (!peopleResponse.ok) throw new Error(peopleBody.error || "Personen konden niet geladen worden.");
    setPeople(peopleBody.people ?? []);
    if (claimsResponse) {
      const claimsBody = await claimsResponse.json();
      if (!claimsResponse.ok) throw new Error(claimsBody.error || "Claims konden niet geladen worden.");
      setClaims(claimsBody.claims ?? []);
    }
  }

  useEffect(() => {
    void load().catch((reason) => setError(reason.message));
  }, [clubId]);

  const visiblePeople = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    return people
      .filter((person) => !needle || `${person.firstName} ${person.lastName} ${person.accounts.map(account => account.profiles?.email ?? "").join(" ")}`
        .toLocaleLowerCase("nl-BE").includes(needle))
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "nl-BE"));
  }, [people, query]);

  async function request(path: string, method: string, body: Record<string, unknown>, key: string) {
    setBusy(key); setError(""); setNotice("");
    const response = await fetch(path, {
      method, headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const responseBody = response.status === 204 ? null : await response.json();
    setBusy("");
    if (!response.ok) {
      setError(responseBody?.error || "De wijziging kon niet worden bewaard.");
      return null;
    }
    await load();
    return responseBody;
  }

  async function invite(person: Person) {
    const email = window.prompt("E-mailadres voor deze persoonlijke uitnodiging (optioneel):", "");
    if (email === null) return;
    const result = await request("/api/club/person-invitations", "POST", {
      clubId, clubPersonId: person.id, email
    }, `invite:${person.id}`);
    if (!result?.token) return;
    const url = `${window.location.origin}/person-invite/${result.token}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setNotice(`Persoonlijke link aangemaakt en gekopieerd: ${url}`);
  }

  async function revoke(account: Account) {
    if (!window.confirm(`Account ${account.profiles?.email ?? ""} ontkoppelen?`)) return;
    await request("/api/club/person-accounts", "DELETE", {
      clubId, personAccountId: account.id, reason: "Ontkoppeld via clubbeheer"
    }, `account:${account.id}`);
  }

  return <section className="rounded-xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-textBright">Personen & accounts</h2>
        <p className="mt-1 text-sm text-textMuted">Beheer één persoon, diens clubrollen en de veilige accountkoppeling.</p>
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Zoek op naam of e-mail…" className={inputClass} />
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <Summary label="Personen" value={people.length} />
      <Summary label="Gekoppelde accounts" value={people.filter(person => person.accounts.some(account => account.status === "active")).length} />
      <Summary label="Zonder account" value={people.filter(person => !person.accounts.some(account => account.status === "active")).length} />
      {!readOnly && <Summary label="Claims te beoordelen" value={claims.length} warning={claims.length > 0} />}
    </div>
    {notice && <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

    {!readOnly && claims.length > 0 && <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="font-semibold text-amber-200">Identiteitsclaims beoordelen</h3>
      <div className="mt-3 space-y-2">{claims.map((claim) => <div key={claim.id} className="rounded-lg border border-borderSubtle bg-cardDeep p-3">
        <p className="text-sm text-textPrimary">
          <strong>{claim.profiles?.full_name || claim.profiles?.email || claim.requested_profile_id}</strong>
          {" → "}
          {claim.people ? `${claim.people.first_name} ${claim.people.last_name}` : "onbekende kandidaat"}
        </p>
        <p className="mt-1 text-xs text-textMuted">Reden: {claim.reason} · aangevraagd {formatDate(claim.created_at)}</p>
        <div className="mt-2 flex gap-2">
          <button disabled={!!busy} onClick={() => void request("/api/club/person-claims", "PATCH", {
            clubId, reviewId: claim.id, decision: "approved"
          }, `claim:${claim.id}`)} className={primaryButton}>Goedkeuren</button>
          <button disabled={!!busy} onClick={() => void request("/api/club/person-claims", "PATCH", {
            clubId, reviewId: claim.id, decision: "rejected"
          }, `claim:${claim.id}`)} className={secondaryButton}>Afwijzen</button>
        </div>
      </div>)}</div>
    </div>}

    <div className="mt-5 space-y-2">{visiblePeople.map((person) => {
      const activeAccount = person.accounts.find((account) => account.status === "active");
      const activeRoles = person.roles.filter((role) => role.status === "active");
      const pendingInvite = person.invitations.find((invite) => invite.status === "pending" && new Date(invite.expires_at) > new Date());
      return <article key={person.id} className="rounded-xl border border-borderSubtle bg-cardDeep">
        <button type="button" onClick={() => setExpanded(expanded === person.id ? "" : person.id)}
          className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
          <span className="min-w-0 flex-1">
            <strong className="block text-textBright">{person.firstName} {person.lastName}</strong>
            <span className="text-xs text-textMuted">{person.dateOfBirth ? `Geboren ${formatDate(person.dateOfBirth)}` : "Geboortedatum niet gekend"}</span>
          </span>
          <StatusBadge activeAccount={activeAccount} pendingInvite={pendingInvite} />
          <span className="text-xs text-textMuted">{activeRoles.length} {activeRoles.length === 1 ? "rol" : "rollen"}</span>
          <span aria-hidden="true" className="text-textMuted">{expanded === person.id ? "▲" : "▼"}</span>
        </button>
        {expanded === person.id && <div className="border-t border-borderSubtle p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-textPrimary">Account</h4>
              {activeAccount ? <div className="mt-2 rounded-lg border border-border bg-card p-3 text-sm">
                <p className="text-textPrimary">{activeAccount.profiles?.email ?? activeAccount.profile_id}</p>
                <p className="mt-1 text-xs text-textMuted">Gekoppeld via {activeAccount.link_method} · {formatDate(activeAccount.verified_at)}</p>
                {!readOnly && <button disabled={!!busy} onClick={() => void revoke(activeAccount)} className={`${secondaryButton} mt-3`}>Account ontkoppelen</button>}
              </div> : <div className="mt-2 rounded-lg border border-dashed border-border p-3">
                <p className="text-sm text-textMuted">{pendingInvite ? `Uitnodiging wacht op gebruik tot ${formatDate(pendingInvite.expires_at)}` : "Nog geen account gekoppeld."}</p>
                {!readOnly && <button disabled={!!busy} onClick={() => void invite(person)} className={`${primaryButton} mt-3`}>
                  {pendingInvite ? "Nieuwe link maken" : "Persoon uitnodigen"}
                </button>}
              </div>}
            </div>
            <RoleEditor person={person} roles={activeRoles} teams={teams} readOnly={readOnly} busy={busy}
              onRequest={request} clubId={clubId} />
          </div>
        </div>}
      </article>;
    })}</div>
    {!visiblePeople.length && <p className="mt-5 text-sm text-textMuted">Geen personen gevonden.</p>}
  </section>;
}

function RoleEditor({ person, roles, teams, readOnly, busy, onRequest, clubId }: {
  person: Person; roles: Role[]; teams: Team[]; readOnly: boolean; busy: string;
  onRequest: (path: string, method: string, body: Record<string, unknown>, key: string) => Promise<unknown>;
  clubId: string;
}) {
  const [roleType, setRoleType] = useState("trainer");
  const [teamId, setTeamId] = useState("");
  return <div>
    <h4 className="text-sm font-semibold text-textPrimary">Clubrollen</h4>
    <div className="mt-2 space-y-2">{roles.map((role) => <div key={role.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
      <span className="min-w-0 flex-1 text-textPrimary">{roleLabels[role.role_type] ?? role.role_type}{role.club_teams?.name ? ` · ${role.club_teams.name}` : ""}</span>
      {!readOnly && <button disabled={!!busy} onClick={() => void onRequest("/api/club/person-roles", "DELETE", {
        clubId, roleAssignmentId: role.id
      }, `role:${role.id}`)} className={secondaryButton}>Beëindigen</button>}
    </div>)}</div>
    {!roles.length && <p className="mt-2 text-sm text-textMuted">Geen actieve clubrol.</p>}
    {!readOnly && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <select value={roleType} onChange={(event) => setRoleType(event.target.value)} className={inputClass}>
        {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className={inputClass}>
        <option value="">Clubbreed</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <button disabled={!!busy} onClick={() => void onRequest("/api/club/person-roles", "POST", {
        clubId, clubPersonId: person.id, roleType, clubTeamId: teamId
      }, `new-role:${person.id}`)} className={primaryButton}>Rol toevoegen</button>
    </div>}
  </div>;
}

function StatusBadge({ activeAccount, pendingInvite }: { activeAccount?: Account; pendingInvite?: Invitation }) {
  if (activeAccount) return <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">Account actief</span>;
  if (pendingInvite) return <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">Uitgenodigd</span>;
  return <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-xs text-textMuted">Geen account</span>;
}
function Summary({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 ${warning ? "bg-amber-500/15 text-amber-300" : "bg-cardDeep text-textSecondary"}`}>{label}: {value}</span>;
}
function formatDate(value: string | null) {
  if (!value) return "onbekend";
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(new Date(value));
}
const inputClass = "rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary";
const primaryButton = "rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-page disabled:opacity-50";
const secondaryButton = "rounded-lg border border-borderButton px-3 py-2 text-xs text-textSecondary disabled:opacity-50";
