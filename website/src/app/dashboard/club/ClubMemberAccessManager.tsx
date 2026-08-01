"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CLUB_FUNCTION_ROLES,
  CLUB_PERMISSION_DESCRIPTIONS,
  CLUB_PERMISSION_OPTIONS,
  defaultPermissionsForRole,
  type TeamScope
} from "@/lib/club-access-options";

type Team = { id: string; name: string };
type GoalkeeperOption = { id: string; name: string };
type Member = {
  club_id: string; profile_id: string; role: string; function_role?: string;
  custom_role_name?: string | null; team_scope?: TeamScope;
};
type Trainer = {
  profile_id: string | null; display_name: string; profiles: { email: string } | null;
  club_trainer_teams?: { club_team_id: string; status?: string }[];
  club_trainer_players?: { player_id: string }[];
};
type Permission = { profile_id: string; permission_key: string; enabled: boolean };
type TeamAccess = { profile_id: string; club_team_id: string };
type RoleDefault = { function_role: string; permission_key: string; enabled: boolean };

export function ClubMemberAccessManager({ clubId, members, trainers, teams, playersByTeam, permissions, teamAccess, roleDefaults, readOnly, onChanged }: {
  clubId: string; members: Member[]; trainers: Trainer[]; teams: Team[]; permissions: Permission[];
  playersByTeam: Record<string, GoalkeeperOption[]>;
  teamAccess: TeamAccess[]; roleDefaults: RoleDefault[]; readOnly: boolean; onChanged: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"last_name" | "first_name" | "role">("last_name");
  const visibleMembers = useMemo(() => members.map((member) => {
    const trainer = trainers.find((item) => item.profile_id === member.profile_id);
    const name = trainer?.display_name || trainer?.profiles?.email || member.profile_id;
    const parts = name.trim().split(/\s+/);
    const roleName = CLUB_FUNCTION_ROLES.find(([role]) => role === (member.function_role || member.role))?.[1] || member.function_role || member.role;
    return { member, trainer, name, roleName, firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || parts[0] || "" };
  }).filter(({ name, roleName }) => `${name} ${roleName}`.toLocaleLowerCase("nl").includes(query.trim().toLocaleLowerCase("nl")))
    .sort((a, b) => {
      const left = sortBy === "first_name" ? a.firstName : sortBy === "role" ? a.roleName : a.lastName;
      const right = sortBy === "first_name" ? b.firstName : sortBy === "role" ? b.roleName : b.lastName;
      return left.localeCompare(right, "nl", { sensitivity: "base" });
    }), [members, trainers, query, sortBy]);

  return <details className="group/access rounded-xl border border-border bg-card">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
      <span>
        <span className="block text-xl font-semibold text-textBright">Clubrollen en toegangsrechten</span>
        <span className="mt-1 block text-sm text-textMuted">Standaardrechten per rol en persoonlijke uitzonderingen beheren.</span>
      </span>
      <span className="text-accent transition-transform group-open/access:rotate-90">▶</span>
    </summary>
    <div className="border-t border-borderSubtle p-5">
      <RolePermissionDefaultsManager clubId={clubId} defaults={roleDefaults} readOnly={readOnly} onChanged={onChanged} />
      <h3 className="mt-6 text-lg font-semibold text-textBright">Persoonlijke rechten</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="text-sm text-textSecondary">Zoeken
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op voornaam, achternaam of rol" className={inputClass} />
        </label>
        <label className="text-sm text-textSecondary">Sorteren op
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className={inputClass}>
            <option value="last_name">Naam</option>
            <option value="first_name">Voornaam</option>
            <option value="role">Rol</option>
          </select>
        </label>
      </div>
      <div className="mt-4 space-y-2">{visibleMembers.map(({ member, trainer, name }) => {
      return <MemberEditor key={member.profile_id} clubId={clubId} member={member}
        name={name}
        assignedTeamIds={(trainer?.club_trainer_teams ?? []).filter((item) => item.status !== "inactive").map((item) => item.club_team_id)}
        assignedPlayerIds={(trainer?.club_trainer_players ?? []).map((item) => item.player_id)}
        playersByTeam={playersByTeam}
        teams={teams} permissions={permissions.filter((item) => item.profile_id === member.profile_id)}
        teamAccess={teamAccess.filter((item) => item.profile_id === member.profile_id)}
        roleDefaults={roleDefaults}
        readOnly={readOnly || ["club_admin", "club_admin_viewer"].includes(member.role)} onChanged={onChanged} />;
      })}</div>
      {!visibleMembers.length && <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-textMuted">Geen personen gevonden.</p>}
    </div>
  </details>;
}

function RolePermissionDefaultsManager({ clubId, defaults, readOnly, onChanged }: {
  clubId: string; defaults: RoleDefault[]; readOnly: boolean; onChanged: () => Promise<void>;
}) {
  const [rolePermissions, setRolePermissions] = useState<Record<string, Set<string>>>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    setRolePermissions(Object.fromEntries(CLUB_FUNCTION_ROLES.map(([role]) => {
      const configured = defaults.filter((item) => item.function_role === role);
      return [role, new Set(configured.length
        ? configured.filter((item) => item.enabled).map((item) => item.permission_key)
        : defaultPermissionsForRole(role))];
    })));
    setStatus("");
  }, [defaults]);

  function togglePermission(role: string, permission: string) {
    setRolePermissions((current) => {
      const next = { ...current, [role]: new Set(current[role] ?? []) };
      if (permission === "teams.import" && !next[role].has("teams.manage")) return current;
      if (next[role].has(permission)) next[role].delete(permission); else next[role].add(permission);
      if (permission === "teams.manage_all" && next[role].has(permission)) {
        next[role].add("teams.view_all");
        next[role].add("teams.view");
        next[role].add("teams.manage");
      }
      if (permission === "teams.view_all" && next[role].has(permission)) next[role].add("teams.view");
      if (permission === "teams.view_all" && !next[role].has(permission)) next[role].delete("teams.manage_all");
      if (permission === "teams.manage" && !next[role].has(permission)) next[role].delete("teams.manage_all");
      if (permission === "teams.manage" && !next[role].has(permission)) next[role].delete("teams.import");
      return next;
    });
  }

  function toggleRole(role: string) {
    setRolePermissions((current) => {
      const allEnabled = CLUB_PERMISSION_OPTIONS.every(([permission]) => current[role]?.has(permission));
      return { ...current, [role]: new Set(allEnabled ? [] : CLUB_PERMISSION_OPTIONS.map(([permission]) => permission)) };
    });
  }

  function togglePermissionRow(permission: string) {
    setRolePermissions((current) => {
      const allEnabled = CLUB_FUNCTION_ROLES.every(([role]) => current[role]?.has(permission));
      return Object.fromEntries(CLUB_FUNCTION_ROLES.map(([role]) => {
        const permissions = new Set(current[role] ?? []);
        if (allEnabled) permissions.delete(permission);
        else if (permission !== "teams.import" || permissions.has("teams.manage")) permissions.add(permission);
        if (permission === "teams.manage_all" && !allEnabled) {
          permissions.add("teams.view_all");
          permissions.add("teams.view");
          permissions.add("teams.manage");
        }
        if (permission === "teams.view_all" && !allEnabled) permissions.add("teams.view");
        if (permission === "teams.view_all" && allEnabled) permissions.delete("teams.manage_all");
        if (permission === "teams.manage" && allEnabled) permissions.delete("teams.import");
        if (permission === "teams.manage" && allEnabled) permissions.delete("teams.manage_all");
        return [role, permissions];
      }));
    });
  }

  async function save() {
    setStatus("Bewaren…");
    const responses = await Promise.all(CLUB_FUNCTION_ROLES.map(([role]) => fetch("/api/club/role-permissions", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, functionRole: role, permissions: [...(rolePermissions[role] ?? [])] })
    })));
    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const body = await failed.json();
      return setStatus(body.error || "De rechtenprofielen konden niet volledig worden bewaard.");
    }
    setStatus("Bewaard");
    await onChanged();
  }

  return <div className="mt-5 rounded-xl border border-borderSubtle bg-cardDeep p-4">
    <h3 className="font-semibold text-textPrimary">Standaardrechten per clubrol</h3>
    <p className="mt-1 text-xs text-textMuted">Vink per rol de standaardrechten aan. De checkbox bij een recht schakelt de volledige rij; die boven een rol schakelt de volledige kolom.</p>
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-card">
            <th className="sticky left-0 z-20 min-w-80 bg-card p-3 text-left text-xs font-semibold text-textMuted">Recht</th>
            {CLUB_FUNCTION_ROLES.map(([role, label]) => {
              const checked = CLUB_PERMISSION_OPTIONS.every(([permission]) => rolePermissions[role]?.has(permission));
              return <th key={role} className="h-44 w-12 min-w-12 max-w-12 border-l border-borderSubtle p-0 align-bottom">
                <div className="relative h-full w-12">
                  <span className="absolute bottom-10 left-1/2 block w-40 origin-bottom-left whitespace-nowrap text-left text-xs font-semibold text-textSecondary" style={{ transform: "rotate(-55deg)" }}>{label}</span>
                  <input aria-label={`Alle rechten voor ${label}`} type="checkbox" checked={checked} disabled={readOnly} onChange={() => toggleRole(role)} className="absolute bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 accent-accent" />
                </div>
              </th>;
            })}
          </tr>
        </thead>
        <tbody>
          {CLUB_PERMISSION_OPTIONS.map(([permission, label]) => {
            const rowChecked = CLUB_FUNCTION_ROLES.every(([role]) => rolePermissions[role]?.has(permission));
            return <tr key={permission} className="border-b border-borderSubtle last:border-b-0">
              <th className={`sticky left-0 z-10 min-w-80 bg-card px-3 py-3 text-left ${permission === "teams.import" ? "pl-10" : ""}`}>
                <span className="flex items-center gap-2">
                  {permission === "teams.import" && <span className="text-accent" aria-hidden="true">↳</span>}
                  <input aria-label={`${label} voor alle rollen`} type="checkbox" checked={rowChecked} disabled={readOnly} onChange={() => togglePermissionRow(permission)} className="h-4 w-4 shrink-0 accent-accent" />
                  <span className="font-semibold text-textPrimary">{label}</span>
                  <InfoTip text={CLUB_PERMISSION_DESCRIPTIONS[permission]} />
                </span>
              </th>
              {CLUB_FUNCTION_ROLES.map(([role, roleLabel]) => {
                const dependencyMissing = permission === "teams.import" && !rolePermissions[role]?.has("teams.manage");
                return <td key={role} className="w-12 min-w-12 max-w-12 border-l border-borderSubtle p-2 text-center">
                  <input aria-label={`${label} voor ${roleLabel}`} title={dependencyMissing ? "Vereist ‘Teams en spelers beheren’" : undefined} type="checkbox" checked={rolePermissions[role]?.has(permission) ?? false} disabled={readOnly || dependencyMissing} onChange={() => togglePermission(role, permission)} className="h-4 w-4 accent-accent disabled:opacity-30" />
                </td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {!readOnly && <button type="button" onClick={() => void save()} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page">Alle standaardrechten opslaan</button>}
    {status && <span className="ml-3 text-sm text-accent">{status}</span>}
  </div>;
}

function MemberEditor({ clubId, member, name, teams, playersByTeam, permissions, teamAccess, assignedTeamIds, assignedPlayerIds, roleDefaults, readOnly, onChanged }: {
  clubId: string; member: Member; name: string; teams: Team[]; permissions: Permission[];
  playersByTeam: Record<string, GoalkeeperOption[]>; teamAccess: TeamAccess[]; assignedTeamIds: string[]; assignedPlayerIds: string[]; roleDefaults: RoleDefault[]; readOnly: boolean; onChanged: () => Promise<void>;
}) {
  const [functionRole, setFunctionRole] = useState(member.function_role || member.role || "trainer");
  const [customRoleName, setCustomRoleName] = useState(member.custom_role_name || "");
  const [teamScope, setTeamScope] = useState<TeamScope>(member.team_scope || (["club_admin", "club_admin_viewer"].includes(member.role) ? "all" : "assigned"));
  const [teamIds, setTeamIds] = useState(() => new Set(teamAccess.map((item) => item.club_team_id)));
  const [assignedIds, setAssignedIds] = useState(() => new Set(assignedTeamIds));
  const [assignedPlayerIdsState, setAssignedPlayerIdsState] = useState(() => new Set(assignedPlayerIds));
  const [permissionKeys, setPermissionKeys] = useState(() => new Set([
    ...permissions.filter((item) => item.enabled).map((item) => item.permission_key),
    ...(!permissions.some((item) => item.permission_key === "intradesk.view") ? ["intradesk.view"] : []),
    ...(permissions.length ? [] : defaultPermissionsForRole(member.function_role || member.role || "trainer"))
  ]));
  const [extraTeamsOpen, setExtraTeamsOpen] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    setFunctionRole(member.function_role || member.role || "trainer");
    setCustomRoleName(member.custom_role_name || "");
    setTeamScope(member.team_scope || (["club_admin", "club_admin_viewer"].includes(member.role) ? "all" : "assigned"));
    setTeamIds(new Set(teamAccess.map((item) => item.club_team_id)));
    setAssignedIds(new Set(assignedTeamIds));
    setAssignedPlayerIdsState(new Set(assignedPlayerIds));
    setPermissionKeys(new Set([
      ...permissions.filter((item) => item.enabled).map((item) => item.permission_key),
      ...(!permissions.some((item) => item.permission_key === "intradesk.view") ? ["intradesk.view"] : []),
      ...(permissions.length ? [] : defaultPermissionsForRole(member.function_role || member.role || "trainer"))
    ]));
    setExtraTeamsOpen(false);
  }, [member, permissions, teamAccess, assignedTeamIds, assignedPlayerIds]);

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function changeFunctionRole(nextRole: string) {
    setFunctionRole(nextRole);
    const configured = roleDefaults.filter((item) => item.function_role === nextRole);
    setPermissionKeys(new Set(configured.length
      ? configured.filter((item) => item.enabled).map((item) => item.permission_key)
      : defaultPermissionsForRole(nextRole)));
  }
  async function save() {
    setStatus("Bewaren…");
    const response = await fetch("/api/club/members/access", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, profileId: member.profile_id, functionRole, customRoleName, teamScope, teamIds: [...teamIds], assignedTeamIds: [...assignedIds], assignedPlayerIds: functionRole === "goalkeeper_coach" ? [...assignedPlayerIdsState] : [], permissions: [...permissionKeys] })
    });
    const body = await response.json();
    if (!response.ok) return setStatus(body.error || "Rechten konden niet worden bewaard.");
    setStatus("Bewaard");
    await onChanged();
  }

  return <details id={`member-${member.profile_id}`} className="group/member scroll-mt-6 rounded-lg border border-borderSubtle bg-cardDeep target:border-accent">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
      <span><strong className="text-textPrimary">{name}</strong><span className="ml-2 text-xs text-textMuted">{CLUB_FUNCTION_ROLES.find(([key]) => key === functionRole)?.[1] || functionRole}</span></span>
      <span className="text-accent transition-transform group-open/member:rotate-90">▶</span>
    </summary>
    <div className="space-y-4 border-t border-borderSubtle p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-textSecondary">Clubrol<select value={functionRole} disabled={readOnly} onChange={(event) => changeFunctionRole(event.target.value)} className={inputClass}>{CLUB_FUNCTION_ROLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm text-textSecondary">
          <span className="flex items-center gap-1.5">Teamtoegang
            <InfoTip text="Teamtoegang bepaalt de harde grens: geen teams, alleen de eigen/toegewezen teams of alle clubteams. Extra ploegen geef je afzonderlijk via het recht ‘Andere teams buiten de eigen ploeg(en) bekijken’." />
          </span>
          <select value={teamScope} disabled={readOnly || ["club_admin", "club_admin_viewer"].includes(member.role)} onChange={(event) => setTeamScope(event.target.value as TeamScope)} className={inputClass}>
            <option value="none">Geen teams</option><option value="assigned">Eigen/toegewezen teams</option><option value="all">Alle teams</option>
          </select>
        </label>
      </div>
      {functionRole === "custom" && <label className="block text-sm text-textSecondary">Naam aangepaste rol<input value={customRoleName} disabled={readOnly} onChange={(event) => setCustomRoleName(event.target.value)} className={inputClass} /></label>}
      <details className="group/assigned rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
          <span><strong className="block text-sm text-textPrimary">Eigen/toegewezen teams</strong><span className="text-sm text-textSecondary">{teams.filter((team) => assignedIds.has(team.id)).map((team) => team.name).join(", ") || "Nog geen team toegewezen"}</span></span>
          <span className="text-accent transition-transform group-open/assigned:rotate-90">▶</span>
        </summary>
        <div className="grid gap-2 border-t border-borderSubtle p-3 sm:grid-cols-2">{teams.map((team) => <label key={team.id} className="flex items-center gap-2 text-sm text-textSecondary"><input type="checkbox" checked={assignedIds.has(team.id)} disabled={readOnly} onChange={() => {
          const wasAssigned = assignedIds.has(team.id);
          toggle(setAssignedIds, team.id);
          if (wasAssigned) setAssignedPlayerIdsState((current) => new Set([...current].filter((playerId) => !(playersByTeam[team.id] ?? []).some((player) => player.id === playerId))));
        }} className="accent-accent" />{team.name}</label>)}</div>
      </details>
      {functionRole === "goalkeeper_coach" && <details className="group/keepers rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
          <span><strong className="block text-sm text-textPrimary">Toegewezen doelmannen</strong><span className="text-sm text-textSecondary">{assignedPlayerIdsState.size ? `${assignedPlayerIdsState.size} geselecteerd` : "Nog geen doelman toegewezen"}</span></span>
          <span className="text-accent transition-transform group-open/keepers:rotate-90">▶</span>
        </summary>
        <div className="space-y-3 border-t border-borderSubtle p-3">{teams.filter((team) => assignedIds.has(team.id)).map((team) => <div key={team.id}>
          <h5 className="text-sm font-semibold text-textPrimary">{team.name}</h5>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{(playersByTeam[team.id] ?? []).map((player) => <label key={player.id} className="flex items-center gap-2 text-sm text-textSecondary"><input type="checkbox" checked={assignedPlayerIdsState.has(player.id)} disabled={readOnly} onChange={() => toggle(setAssignedPlayerIdsState, player.id)} className="accent-accent" />{player.name}</label>)}</div>
          {!(playersByTeam[team.id] ?? []).length && <p className="mt-2 text-xs text-textMuted">In deze ploeg zijn nog geen doelmannen gemarkeerd.</p>}
        </div>)}</div>
      </details>}
      <div><h4 className="text-sm font-semibold text-textPrimary">Rechten</h4><div className="mt-2 grid items-start gap-2 md:grid-cols-2">{CLUB_PERMISSION_OPTIONS.map(([key, label]) => {
        const checked = permissionKeys.has(key);
        return <div key={key} className="rounded-lg border border-border">
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-textSecondary">
            <input type="checkbox" checked={checked} disabled={readOnly} onChange={() => {
              toggle(setPermissionKeys, key);
              if (key === "teams.view") {
                if (checked) {
                  setTeamIds(new Set());
                  setExtraTeamsOpen(false);
                } else {
                  setExtraTeamsOpen(true);
                }
              }
            }} className="accent-accent" />
            <span className="flex min-w-0 items-center gap-2">{label}<InfoTip text={CLUB_PERMISSION_DESCRIPTIONS[key]} /></span>
          </label>
          {key === "teams.view" && checked && teamScope === "assigned" && <details open={extraTeamsOpen} onToggle={(event) => setExtraTeamsOpen(event.currentTarget.open)} className="group/extra border-t border-borderSubtle">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-accent">
              Extra teams bekijken <span className="transition-transform group-open/extra:rotate-90">▶</span>
            </summary>
            <div className="space-y-2 border-t border-borderSubtle p-3">
              <p className="text-xs text-textMuted">Vink bijkomende teams aan naast de eigen/toegewezen ploeg(en).</p>
              {teams.filter((team) => !assignedIds.has(team.id)).map((team) => <label key={team.id} className="flex items-center gap-2 text-sm text-textSecondary"><input type="checkbox" checked={teamIds.has(team.id)} disabled={readOnly} onChange={() => toggle(setTeamIds, team.id)} className="accent-accent" />{team.name}</label>)}
            </div>
          </details>}
        </div>;
      })}</div></div>
      {!readOnly && <button type="button" onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page">Instellingen opslaan</button>}
      {status && <span className="ml-3 text-sm text-accent">{status}</span>}
    </div>
  </details>;
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const visible = open || hovered;
  function positionTooltip(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: Math.max(12, Math.min(rect.left - 8, window.innerWidth - 300))
    });
  }
  return <span
    role="button"
    aria-label="Meer informatie"
    aria-expanded={visible}
    tabIndex={0}
    onMouseEnter={(event) => {
      positionTooltip(event.currentTarget);
      setHovered(true);
    }}
    onMouseLeave={() => setHovered(false)}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      positionTooltip(event.currentTarget);
      setOpen((current) => !current);
    }}
    onKeyDown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen((current) => !current);
    }}
    className="relative inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-accent bg-accent/10 text-lg font-black italic leading-none text-accent shadow-sm"
    style={{ fontFamily: '"Allura", "Arizonia", "Brush Script MT", cursive' }}
  >
    i
    {visible && typeof document !== "undefined" && createPortal(
      <span role="tooltip" className="pointer-events-none fixed z-[100] w-72 rounded-lg border border-accent/40 bg-card p-3 text-left text-xs font-normal not-italic leading-relaxed text-textSecondary shadow-xl"
        style={{ top: position.top, left: position.left, fontFamily: "Arial, sans-serif" }}>
        {text}
      </span>,
      document.body
    )}
  </span>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary disabled:opacity-60";
