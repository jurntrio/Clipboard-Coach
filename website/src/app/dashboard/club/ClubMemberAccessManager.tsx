"use client";

import { useEffect, useState } from "react";
import { CLUB_FUNCTION_ROLES, CLUB_PERMISSION_OPTIONS, type TeamScope } from "@/lib/club-access-options";

type Team = { id: string; name: string };
type Member = {
  club_id: string; profile_id: string; role: string; function_role?: string;
  custom_role_name?: string | null; team_scope?: TeamScope;
};
type Trainer = {
  profile_id: string | null; display_name: string; profiles: { email: string } | null;
  club_trainer_teams?: { club_team_id: string; status?: string }[];
};
type Permission = { profile_id: string; permission_key: string; enabled: boolean };
type TeamAccess = { profile_id: string; club_team_id: string };

export function ClubMemberAccessManager({ clubId, members, trainers, teams, permissions, teamAccess, readOnly, onChanged }: {
  clubId: string; members: Member[]; trainers: Trainer[]; teams: Team[]; permissions: Permission[];
  teamAccess: TeamAccess[]; readOnly: boolean; onChanged: () => Promise<void>;
}) {
  return <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold text-textBright">Clubrollen en toegangsrechten</h2>
    <p className="mt-1 text-sm text-textMuted">Iedere persoon krijgt een clubfunctie, een teamscope en expliciete actierechten. Alle personen staan standaard dichtgeklapt.</p>
    <div className="mt-4 space-y-2">{members.map((member) => {
      const trainer = trainers.find((item) => item.profile_id === member.profile_id);
      return <MemberEditor key={member.profile_id} clubId={clubId} member={member}
        name={trainer?.display_name || trainer?.profiles?.email || member.profile_id}
        assignedTeamIds={(trainer?.club_trainer_teams ?? []).filter((item) => item.status !== "inactive").map((item) => item.club_team_id)}
        teams={teams} permissions={permissions.filter((item) => item.profile_id === member.profile_id)}
        teamAccess={teamAccess.filter((item) => item.profile_id === member.profile_id)}
        readOnly={readOnly || ["club_admin", "club_admin_viewer"].includes(member.role)} onChanged={onChanged} />;
    })}</div>
  </section>;
}

function MemberEditor({ clubId, member, name, teams, permissions, teamAccess, assignedTeamIds, readOnly, onChanged }: {
  clubId: string; member: Member; name: string; teams: Team[]; permissions: Permission[];
  teamAccess: TeamAccess[]; assignedTeamIds: string[]; readOnly: boolean; onChanged: () => Promise<void>;
}) {
  const [functionRole, setFunctionRole] = useState(member.function_role || member.role || "trainer");
  const [customRoleName, setCustomRoleName] = useState(member.custom_role_name || "");
  const [teamScope, setTeamScope] = useState<TeamScope>(member.team_scope || (["club_admin", "club_admin_viewer"].includes(member.role) ? "all" : "assigned"));
  const [teamIds, setTeamIds] = useState(() => new Set(teamAccess.map((item) => item.club_team_id)));
  const [assignedIds, setAssignedIds] = useState(() => new Set(assignedTeamIds));
  const defaultTrainerPermissions = ["video.view", "games.tag_link.create", "games.tag", "training.view", "intradesk.view", "clips.share"];
  const [permissionKeys, setPermissionKeys] = useState(() => new Set([
    ...permissions.filter((item) => item.enabled).map((item) => item.permission_key),
    "intradesk.view",
    ...(member.role === "trainer" && !permissions.length ? defaultTrainerPermissions : [])
  ]));
  const [extraTeamsOpen, setExtraTeamsOpen] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    setFunctionRole(member.function_role || member.role || "trainer");
    setCustomRoleName(member.custom_role_name || "");
    setTeamScope(member.team_scope || (["club_admin", "club_admin_viewer"].includes(member.role) ? "all" : "assigned"));
    setTeamIds(new Set(teamAccess.map((item) => item.club_team_id)));
    setAssignedIds(new Set(assignedTeamIds));
    setPermissionKeys(new Set([
      ...permissions.filter((item) => item.enabled).map((item) => item.permission_key),
      "intradesk.view",
      ...(member.role === "trainer" && !permissions.length ? defaultTrainerPermissions : [])
    ]));
    setExtraTeamsOpen(false);
  }, [member, permissions, teamAccess, assignedTeamIds]);

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  async function save() {
    setStatus("Bewaren…");
    const response = await fetch("/api/club/members/access", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, profileId: member.profile_id, functionRole, customRoleName, teamScope, teamIds: [...teamIds], assignedTeamIds: [...assignedIds], permissions: [...permissionKeys] })
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
        <label className="text-sm text-textSecondary">Clubrol<select value={functionRole} disabled={readOnly} onChange={(event) => setFunctionRole(event.target.value)} className={inputClass}>{CLUB_FUNCTION_ROLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm text-textSecondary">
          <span className="flex items-center gap-1.5">Teamtoegang
            <span className="group/info relative inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-textMuted text-[10px] font-bold text-textMuted" aria-label="Informatie over teamtoegang">
              i
              <span className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-lg border border-border bg-card p-3 text-left text-xs font-normal leading-relaxed text-textSecondary shadow-xl group-hover/info:block">
                Teamtoegang bepaalt de harde grens: geen teams, alleen de eigen/toegewezen teams of alle clubteams. Extra ploegen geef je afzonderlijk via het recht ‘Andere teams buiten de eigen ploeg(en) bekijken’.
              </span>
            </span>
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
        <div className="grid gap-2 border-t border-borderSubtle p-3 sm:grid-cols-2">{teams.map((team) => <label key={team.id} className="flex items-center gap-2 text-sm text-textSecondary"><input type="checkbox" checked={assignedIds.has(team.id)} disabled={readOnly} onChange={() => toggle(setAssignedIds, team.id)} className="accent-accent" />{team.name}</label>)}</div>
      </details>
      <div><h4 className="text-sm font-semibold text-textPrimary">Rechten</h4><div className="mt-2 grid items-start gap-2 md:grid-cols-2">{CLUB_PERMISSION_OPTIONS.map(([key, label]) => {
        const alwaysEnabled = key === "intradesk.view";
        const checked = alwaysEnabled || permissionKeys.has(key);
        return <div key={key} className="rounded-lg border border-border">
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-textSecondary">
            <input type="checkbox" checked={checked} disabled={readOnly || alwaysEnabled} onChange={() => {
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
            {label}{alwaysEnabled && <span className="ml-auto text-xs text-accent">altijd</span>}
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

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary disabled:opacity-60";
