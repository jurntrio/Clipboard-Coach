"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match, Team } from "@/types/database";
import { useI18n } from "@/i18n/client";

export function MatchDetailsCard({ match, videoCount, onSaved, onReplaceVideos, onDeleteMatch, replacing = false }: { match: Match; videoCount: number; onSaved: (match: Match) => void; onReplaceVideos?: () => void; onDeleteMatch?: () => void; replacing?: boolean }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamAId, setTeamAId] = useState(match.team_a_id ?? "");
  const [teamAName, setTeamAName] = useState(match.team_a_name ?? "");
  const [teamBId, setTeamBId] = useState(match.team_b_id ?? "");
  const [teamBName, setTeamBName] = useState(match.team_b_name ?? "");
  const [date, setDate] = useState(match.match_date ?? "");
  const [startTime, setStartTime] = useState(match.start_time ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function beginEdit() {
    const { data } = await supabase.from("teams").select("*").not("name", "ilike", "EXTRA").order("name");
    setTeams(data ?? []);
    setEditing(true);
  }

  function chooseTeam(side: "a" | "b", id: string) {
    const selected = teams.find((team) => team.id === id);
    if (side === "a") { setTeamAId(id); if (selected) setTeamAName(selected.name); }
    else { setTeamBId(id); if (selected) setTeamBName(selected.name); }
  }

  async function save() {
    setSaving(true); setError("");
    const changes = { team_a_id: teamAId || null, team_a_name: teamAName.trim() || t("match.teamA"), team_b_id: teamBId || null, team_b_name: teamBName.trim() || t("match.teamB"), match_date: date || null, start_time: startTime || null };
    const { data, error: updateError } = await supabase.from("matches").update(changes).eq("id", match.id).select().single();
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    onSaved({ ...match, ...data }); setEditing(false);
  }

  if (editing) return <section className="rounded-xl border border-accent bg-cardDeep p-3"><h2 className="mb-3 text-sm font-semibold text-textBright">{t("match.edit")}</h2><div className="space-y-3"><TeamField label={t("match.teamA")} customLabel={t("match.customTeam")} teams={teams} teamId={teamAId} name={teamAName} onTeamChange={(id) => chooseTeam("a", id)} onNameChange={setTeamAName} /><TeamField label={t("match.teamB")} customLabel={t("match.customTeam")} teams={teams} teamId={teamBId} name={teamBName} onTeamChange={(id) => chooseTeam("b", id)} onNameChange={setTeamBName} /><label className="block text-xs text-textSecondary">{t("match.date")}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label><label className="block text-xs text-textSecondary">{t("match.startTime")}<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={inputClass} /></label></div>{(onReplaceVideos || onDeleteMatch) && <div className="mt-4 grid gap-2 border-t border-border pt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-textMuted">{t("match.videoManagement")}</p>{onReplaceVideos && <button type="button" disabled={saving || replacing || videoCount === 0} onClick={onReplaceVideos} className="rounded-lg border border-borderButton bg-button px-3 py-2 text-xs font-semibold text-textPrimary hover:border-accent disabled:opacity-50">{replacing ? t("match.replacing") : t("match.replace")}</button>}{onDeleteMatch && <button type="button" disabled={saving || replacing} onClick={onDeleteMatch} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50">{t("match.delete")}</button>}</div>}{error && <p className="mt-2 text-xs text-red-300">{error}</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={() => setEditing(false)} className="flex-1 rounded-lg bg-button px-2 py-2 text-xs text-textPrimary">{t("common.cancel")}</button><button type="button" disabled={saving} onClick={() => void save()} className="flex-1 rounded-lg bg-accent px-2 py-2 text-xs font-semibold text-page disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button></div></section>;

  return <section className="rounded-xl border border-border bg-cardDeep p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold text-textBright">{match.team_a_name || t("match.teamA")} – {match.team_b_name || t("match.teamB")}</p><p className="mt-1 text-xs text-textMuted">{match.match_date || t("match.noDate")}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""} · {t("match.videoCount", { count: videoCount })}</p></div><button type="button" onClick={() => void beginEdit()} title={t("match.edit")} aria-label={t("match.edit")} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/edit.png" alt={t("common.edit")} width={22} height={22} /></button></div></section>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-2 py-2 text-sm text-textPrimary";
function TeamField({ label, customLabel, teams, teamId, name, onTeamChange, onNameChange }: { label: string; customLabel: string; teams: Team[]; teamId: string; name: string; onTeamChange: (id: string) => void; onNameChange: (name: string) => void }) { return <label className="block text-xs text-textSecondary">{label}<select value={teamId} onChange={(event) => onTeamChange(event.target.value)} className={inputClass}><option value="">{customLabel}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!teamId && <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={label} className={inputClass} />}</label>; }
