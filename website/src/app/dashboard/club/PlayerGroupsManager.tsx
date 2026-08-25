"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamTrainingScheduler } from "@/components/teams/TeamTrainingScheduler";
import type { ClubMatchOption } from "@/components/clubs/ClubMatchOptionsManager";

type Player = { id: string; first_name: string; last_name: string; role: "player" | "staff" };
type Team = { id: string; name: string; teams?: { players: Player[] }[] };
type Trainer = { id: string; display_name: string };
type Group = {
  id: string; name: string; group_type: string; description: string | null; age_category: string | null; icon: string | null; active: boolean;
  player_group_players: { player_id: string }[];
  player_group_staff: { trainer_id: string; role_label: string | null }[];
  player_group_evaluation_criteria: { id: string; name: string; description: string | null; sort_order: number; active: boolean }[];
};

const TYPES = [
  ["goalkeeper_training", "Keepertraining", "🥅"], ["technique_training", "Techniektraining", "⚽"],
  ["talent_development", "Talentontwikkeling", "⭐"], ["position_training", "Positietraining", "📍"],
  ["physical_training", "Fysieke training", "💪"], ["rehabilitation", "Revalidatie", "❤️‍🩹"],
  ["selection_group", "Selectiegroep", "👥"], ["other", "Andere", "➕"]
] as const;
const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
const blank = { id: "", name: "", groupType: "goalkeeper_training", description: "", ageCategory: "", icon: "", active: true, playerIds: [] as string[], trainerIds: [] as string[], criteria: "" };

export function PlayerGroupsManager({ teams, trainers, options }: { teams: Team[]; trainers: Trainer[]; options: ClubMatchOption[] }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [draft, setDraft] = useState(blank);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const players = useMemo(() => teams.flatMap(team => (team.teams?.[0]?.players ?? []).filter(player => player.role === "player").map(player => ({ ...player, teamId: team.id, teamName: team.name }))), [teams]);
  const visiblePlayers = players.filter(player => (!teamFilter || player.teamId === teamFilter) && `${player.first_name} ${player.last_name} ${player.teamName}`.toLocaleLowerCase("nl-BE").includes(search.toLocaleLowerCase("nl-BE")));

  async function load() {
    const response = await fetch("/api/club/player-groups");
    const body = await response.json();
    if (response.ok) setGroups(body.groups ?? []); else setError(body.error || "Extra groepen konden niet worden geladen.");
  }
  useEffect(() => { void load(); }, []);

  function edit(group?: Group) {
    if (!group) return setDraft({ ...blank, playerIds: [], trainerIds: [] });
    setDraft({ id: group.id, name: group.name, groupType: group.group_type, description: group.description ?? "", ageCategory: group.age_category ?? "", icon: group.icon ?? "", active: group.active,
      playerIds: group.player_group_players.map(item => item.player_id), trainerIds: group.player_group_staff.map(item => item.trainer_id),
      criteria: [...group.player_group_evaluation_criteria].sort((a, b) => a.sort_order - b.sort_order).filter(item => item.active).map(item => item.name).join("\n") });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/club/player-groups", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      groupId: draft.id || undefined, name: draft.name, groupType: draft.groupType, description: draft.description, ageCategory: draft.ageCategory,
      icon: draft.icon || TYPES.find(type => type[0] === draft.groupType)?.[2], active: draft.active, playerIds: draft.playerIds, trainerIds: draft.trainerIds,
      criteria: draft.criteria.split("\n").map(name => ({ name: name.trim() })).filter(item => item.name)
    }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error || "Extra groep kon niet worden opgeslagen.");
    edit(); await load();
  }

  const toggle = (key: "playerIds" | "trainerIds", id: string) => setDraft(current => ({ ...current, [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id] }));
  return <section className="rounded-xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-textBright">Extra groepen</h2><p className="mt-1 text-sm text-textMuted">Aanvullende groepen naast het gewone team van een speler.</p></div><button type="button" onClick={() => edit()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Nieuwe groep</button></div>
    {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">{groups.map(group => <button type="button" key={group.id} onClick={() => edit(group)} className={`rounded-xl border p-4 text-left hover:border-accent ${group.active ? "border-borderSubtle bg-cardDeep" : "border-border bg-cardDeep opacity-60"}`}>
      <span className="text-xl">{group.icon || TYPES.find(type => type[0] === group.group_type)?.[2]}</span><strong className="ml-2 text-textBright">{group.name}</strong>
      <p className="mt-1 text-xs text-textMuted">{TYPES.find(type => type[0] === group.group_type)?.[1]} · {group.player_group_players.length} spelers · {group.player_group_staff.length} staf{!group.active ? " · Inactief" : ""}</p>
    </button>)}</div>
    {!groups.length && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen Extra groepen.</p>}

    <form onSubmit={save} className="mt-5 space-y-4 rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <h3 className="font-semibold text-textBright">{draft.id ? "Extra groep aanpassen" : "Extra groep aanmaken"}</h3>
      <div className="grid gap-3 md:grid-cols-2"><label className="text-sm text-textSecondary">Naam<input required value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} className={`mt-1 ${inputClass}`} /></label>
      <label className="text-sm text-textSecondary">Type<select value={draft.groupType} onChange={event => setDraft(current => ({ ...current, groupType: event.target.value }))} className={`mt-1 ${inputClass}`}>{TYPES.map(type => <option key={type[0]} value={type[0]}>{type[1]}</option>)}</select></label>
      <label className="text-sm text-textSecondary">Leeftijdscategorie (optioneel)<input value={draft.ageCategory} onChange={event => setDraft(current => ({ ...current, ageCategory: event.target.value }))} className={`mt-1 ${inputClass}`} /></label>
      <label className="text-sm text-textSecondary">Icoon (optioneel)<input value={draft.icon} onChange={event => setDraft(current => ({ ...current, icon: event.target.value }))} placeholder="Bijv. 🥅" className={`mt-1 ${inputClass}`} /></label></div>
      <label className="block text-sm text-textSecondary">Beschrijving<textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} rows={2} className={`mt-1 ${inputClass}`} /></label>
      <fieldset><legend className="text-sm font-semibold text-textSecondary">Spelers</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Zoek speler…" className={inputClass} /><select value={teamFilter} onChange={event => setTeamFilter(event.target.value)} className={inputClass}><option value="">Alle teams</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></div>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-borderSubtle p-2">{visiblePlayers.map(player => <label key={player.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-textPrimary hover:bg-cardHover"><input type="checkbox" checked={draft.playerIds.includes(player.id)} onChange={() => toggle("playerIds", player.id)} />{player.first_name} {player.last_name}<span className="ml-auto text-xs text-textMuted">{player.teamName}</span></label>)}</div></fieldset>
      <fieldset><legend className="text-sm font-semibold text-textSecondary">Trainers en staf</legend><div className="mt-2 flex flex-wrap gap-2">{trainers.map(trainer => <label key={trainer.id} className="flex items-center gap-2 rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary"><input type="checkbox" checked={draft.trainerIds.includes(trainer.id)} onChange={() => toggle("trainerIds", trainer.id)} />{trainer.display_name}</label>)}</div></fieldset>
      <label className="block text-sm text-textSecondary">Evaluatiecriteria <span className="text-xs text-textMuted">(één per regel)</span><textarea value={draft.criteria} onChange={event => setDraft(current => ({ ...current, criteria: event.target.value }))} rows={4} placeholder={draft.groupType === "goalkeeper_training" ? "Positionering\nCoaching en communicatie\nHoge ballen\n1-tegen-1\nVoetenspel\nReflexen" : "Eerste aanname\nPassing\nDribbel"} className={`mt-1 ${inputClass}`} /></label>
      <label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))} />Groep actief</label>
      <button disabled={busy} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Bewaren…" : "Extra groep bewaren"}</button>
    </form>
    {draft.id && <div className="mt-5"><h3 className="mb-2 font-semibold text-textBright">Trainingen voor {draft.name}</h3><TeamTrainingScheduler groupId={draft.id} trainers={trainers.map(trainer => ({ ...trainer, profile_id: null }))} assignedTrainerIds={draft.trainerIds} options={options} /></div>}
  </section>;
}
