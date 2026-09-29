"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PersonalTrainingLibrary, type PersonalTrainingRow } from "./PersonalTrainingLibrary";
import type { MediaItem, MediaMatch } from "./MediaArchive";

export type IntradeskTrainingRow = { id: string; title: string; ageCategory: string; themes: string[]; version: number; updatedAt: string; author: string; seasonId: string | null; teamId: string | null };
export type TrainingSeason = { id: string; name: string };
export type TrainingTeam = { id: string; seasonId: string; name: string };
type Selection = { type: "all" | "personal" | "unassigned" } | { type: "season" | "team" | "trainings" | "matches" | "match"; id: string };
type MatchClipData = { matches: MediaMatch[]; items: MediaItem[] };

export function IntradeskLibrary({ trainings, personalTrainings, seasons, teams, canEdit = false }: {
  trainings: IntradeskTrainingRow[];
  personalTrainings: PersonalTrainingRow[];
  seasons: TrainingSeason[];
  teams: TrainingTeam[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [managedTrainings, setManagedTrainings] = useState(trainings);
  const [selection, setSelection] = useState<Selection>({ type: "all" });
  const [expanded, setExpanded] = useState(() => new Set(seasons.filter(season => isDefaultOpenSeason(season.name)).map(season => season.id)));
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set());
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(() => new Set());
  const [matchClips, setMatchClips] = useState<Map<string, MatchClipData>>(() => new Map());
  const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null);
  const [matchError, setMatchError] = useState("");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => managedTrainings.filter(training => {
    const selectedId = "id" in selection ? selection.id : null;
    const inFolder = selection.type === "all"
      || selection.type === "unassigned" && (!training.seasonId || !training.teamId)
      || selection.type === "season" && training.seasonId === selectedId
      || (selection.type === "team" || selection.type === "trainings") && training.teamId === selectedId;
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    return inFolder && (!needle || training.title.toLocaleLowerCase("nl-BE").includes(needle) || training.themes.some(theme => theme.toLocaleLowerCase("nl-BE").includes(needle)));
  }), [managedTrainings, query, selection]);
  const selectedId = "id" in selection ? selection.id : null;
  const loadedMatches = [...matchClips.values()].flatMap(value => value.matches);
  const loadedItems = [...matchClips.values()].flatMap(value => value.items);
  const selectedMatch = selection.type === "match" ? loadedMatches.find(match => match.id === selection.id) : null;
  const selectedMatches = selection.type === "matches" ? matchClips.get(selection.id)?.matches ?? [] : [];
  const selectedClips = selection.type === "match" ? loadedItems.filter(item => item.matchId === selection.id) : [];
  const title = selection.type === "all" ? "Alle clubtrainingen"
    : selection.type === "personal" ? "Eigen trainingen"
    : selection.type === "unassigned" ? "Niet toegewezen"
    : selection.type === "season" ? `Seizoen ${formatSeason(seasons.find(item => item.id === selectedId)?.name ?? "")}`
    : selection.type === "trainings" ? `Trainingen · ${teams.find(item => item.id === selectedId)?.name ?? "Ploeg"}`
    : selection.type === "matches" ? `Wedstrijden met clips · ${teams.find(item => item.id === selectedId)?.name ?? "Ploeg"}`
    : selection.type === "match" ? selectedMatch?.title ?? "Wedstrijd"
    : teams.find(item => item.id === selectedId)?.name ?? "Ploeg";
  const unassigned = managedTrainings.filter(training => !training.seasonId || !training.teamId).length;
  const resultCount = selection.type === "personal" ? personalTrainings.length : selection.type === "matches" ? selectedMatches.length : selection.type === "match" ? selectedClips.length : visible.length;

  async function assignTeam(trainingId: string, teamId: string) {
    const response = await fetch("/api/intradesk/training-placement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingId, teamId: teamId || null }) });
    if (!response.ok) return;
    const team = teams.find(item => item.id === teamId);
    setManagedTrainings(current => current.map(item => item.id === trainingId ? { ...item, teamId: team?.id ?? null, seasonId: team?.seasonId ?? null } : item));
  }

  async function loadMatchClips(teamId: string) {
    if (matchClips.has(teamId) || loadingTeamId === teamId) return;
    setLoadingTeamId(teamId); setMatchError("");
    try {
      const response = await fetch(`/api/intradesk/match-clips?teamId=${encodeURIComponent(teamId)}`);
      const body = await response.json().catch(() => null) as MatchClipData & { error?: string } | null;
      if (!response.ok || !body) throw new Error(body?.error || "De wedstrijden konden niet worden geladen.");
      setMatchClips(current => new Map(current).set(teamId, { matches: body.matches ?? [], items: body.items ?? [] }));
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "De wedstrijden konden niet worden geladen.");
    } finally {
      setLoadingTeamId(null);
    }
  }

  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-border bg-accentDim px-4 py-3">
      <label className="relative block min-w-60 max-w-md flex-1"><span className="pointer-events-none absolute left-3 top-2.5 text-textMuted">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek op naam of thema…" disabled={selection.type === "personal"} className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-textPrimary outline-none focus:border-accent disabled:opacity-50" /></label>
    </div>
    <div className="grid min-h-[590px] lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-cardDeep p-3 lg:border-b-0 lg:border-r">
        <TreeButton active={selection.type === "all"} label="Intradesk" icon="library" count={managedTrainings.length} onClick={() => setSelection({ type: "all" })} />
        <div className="treeBranch relative ml-3 mt-1 space-y-0.5 pl-4">
          {seasons.map(season => { const open = expanded.has(season.id); const seasonTeams = teams.filter(team => team.seasonId === season.id); return <div key={season.id}>
            <TreeButton active={selection.type === "season" && selection.id === season.id} label={`Seizoen ${formatSeason(season.name)}`} icon="season" open={open} onToggle={() => setExpanded(toggleSet(expanded, season.id))} onClick={() => setSelection({ type: "season", id: season.id })} />
            {open && <div className="treeBranch ml-4 pl-4">{seasonTeams.map(team => { const teamOpen = expandedTeams.has(team.id); const matchesOpen = expandedMatches.has(team.id); const data = matchClips.get(team.id); return <div key={team.id}>
              <TreeButton active={selection.type === "team" && selection.id === team.id} label={team.name} icon="team" open={teamOpen} onToggle={() => setExpandedTeams(toggleSet(expandedTeams, team.id))} onClick={() => setSelection({ type: "team", id: team.id })} />
              {teamOpen && <div className="treeBranch ml-4 pl-4">
                <TreeButton active={selection.type === "trainings" && selection.id === team.id} label="Trainingen" icon="training" count={managedTrainings.filter(training => training.teamId === team.id).length} onClick={() => setSelection({ type: "trainings", id: team.id })} />
                <TreeButton active={selection.type === "matches" && selection.id === team.id} label={loadingTeamId === team.id ? "Wedstrijden laden…" : "Wedstrijden"} icon="matches" count={data?.matches.length} open={matchesOpen} onToggle={() => { setExpandedMatches(toggleSet(expandedMatches, team.id)); void loadMatchClips(team.id); }} onClick={() => { setSelection({ type: "matches", id: team.id }); void loadMatchClips(team.id); }} />
                {matchesOpen && data && <div className="treeBranch ml-4 pl-4">{data.matches.map(match => <TreeButton key={match.id} active={selection.type === "match" && selection.id === match.id} label={match.opponent || match.title} icon="match" count={data.items.filter(item => item.matchId === match.id).length} onClick={() => setSelection({ type: "match", id: match.id })} />)}{!data.matches.length && <p className="px-3 py-2 text-xs text-textMuted">Geen wedstrijden met clips</p>}</div>}
              </div>}
            </div>; })}{!seasonTeams.length && <p className="px-3 py-2 text-xs text-textMuted">Geen ploegen</p>}</div>}
          </div>; })}
          <TreeButton active={selection.type === "unassigned"} label="Niet toegewezen" icon="unassigned" count={unassigned} onClick={() => setSelection({ type: "unassigned" })} />
          <div className="mt-3 border-t border-border pt-2"><TreeButton active={selection.type === "personal"} label="Eigen trainingen" icon="personal" count={personalTrainings.length} onClick={() => setSelection({ type: "personal" })} /></div>
        </div>
      </aside>

      <div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Intradesk</p><h2 className="mt-1 text-xl font-black text-textBright">{title}</h2></div><span className="text-sm text-textMuted">{resultCount} resultaat{resultCount === 1 ? "" : "en"}</span></div>
        {matchError && <p className="m-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{matchError}</p>}
        {selection.type === "personal" ? <PersonalTrainingLibrary trainings={personalTrainings} embedded />
          : selection.type === "matches" ? loadingTeamId === selection.id ? <LoadingState /> : <MatchList matches={selectedMatches} items={matchClips.get(selection.id)?.items ?? []} onOpen={id => setSelection({ type: "match", id })} />
          : selection.type === "match" ? <ClipList clips={selectedClips} />
          : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-border bg-cardDeep text-xs uppercase tracking-wide text-textMuted"><th className="px-5 py-3 font-bold">Naam</th><th className="px-4 py-3 font-bold">Ploeg</th><th className="px-4 py-3 font-bold">Gewijzigd</th><th className="px-4 py-3 font-bold">Auteur</th><th className="px-4 py-3 font-bold">Versie</th>{canEdit && <th className="px-4 py-3 text-right font-bold">Actie</th>}</tr></thead>
          <tbody className="divide-y divide-borderSubtle">{visible.map(training => <tr key={training.id} tabIndex={0} onClick={() => router.push(`/dashboard/intradesk/${training.id}`)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/dashboard/intradesk/${training.id}`); } }} className="group cursor-pointer transition hover:bg-cardHover focus:bg-cardHover focus:outline-none"><td className="px-5 py-4"><Link href={`/dashboard/intradesk/${training.id}`} className="flex items-center gap-3 font-bold text-textPrimary group-hover:text-accent"><DocumentIcon /><span>{training.title}{!!training.themes.length && <small className="mt-1 block font-normal text-textMuted">{training.themes.join(" · ")}</small>}</span></Link></td><td className="px-4 py-4 text-sm text-textSecondary">{canEdit ? <select value={training.teamId ?? ""} onClick={event => event.stopPropagation()} onChange={event => { event.stopPropagation(); void assignTeam(training.id, event.target.value); }} className="max-w-44 rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-textPrimary"><option value="">Niet toegewezen</option>{seasons.map(season => <optgroup key={season.id} label={formatSeason(season.name)}>{teams.filter(team => team.seasonId === season.id).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</optgroup>)}</select> : teams.find(team => team.id === training.teamId)?.name ?? "Niet toegewezen"}</td><td className="px-4 py-4 text-sm text-textSecondary">{new Date(training.updatedAt).toLocaleDateString("nl-BE")}</td><td className="px-4 py-4 text-sm text-textSecondary">{training.author}</td><td className="px-4 py-4 text-sm font-semibold text-textSecondary">v{training.version}</td>{canEdit && <td className="px-4 py-4 text-right"><Link href={`/dashboard/training/new?edit=${training.id}`} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} className="inline-flex rounded-lg border border-accent px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent hover:text-page">Bewerken</Link></td>}</tr>)}</tbody></table>
          {!visible.length && <EmptyState />}
        </div>}
      </div>
    </div>
  </section>;
}

function MatchList({ matches, items, onOpen }: { matches: MediaMatch[]; items: MediaItem[]; onOpen: (id: string) => void }) {
  if (!matches.length) return <EmptyMessage title="Geen wedstrijden met clips" detail="Voor deze ploeg zijn nog geen wedstrijdclips beschikbaar." />;
  return <div className="grid gap-3 p-5 xl:grid-cols-2">{matches.map(match => { const count = items.filter(item => item.matchId === match.id).length; const score = match.scoreA !== null && match.scoreB !== null ? ` · ${match.scoreA}–${match.scoreB}` : ""; return <article key={match.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4"><Link href={`/dashboard/games/${match.id}#wedstrijdverslag`} className="font-bold text-textBright underline decoration-accent/40 underline-offset-4 hover:text-accent">{match.title}{score}</Link><p className="mt-1 text-xs text-textMuted">{match.date ? new Date(`${match.date}T12:00:00`).toLocaleDateString("nl-BE") : "Datum onbekend"} · {count} clip{count === 1 ? "" : "s"}</p><button type="button" onClick={() => onOpen(match.id)} className="mt-4 rounded-lg border border-borderButton px-3 py-2 text-sm font-bold text-textPrimary hover:border-accent hover:text-accent">Bekijk alle {count} clip{count === 1 ? "" : "s"} →</button></article>; })}</div>;
}
function ClipList({ clips }: { clips: MediaItem[] }) {
  if (!clips.length) return <EmptyMessage title="Geen clips gevonden" detail="Deze wedstrijd heeft momenteel geen beschikbare clips." />;
  return <div className="space-y-2 p-5">{clips.map(clip => <Link key={clip.id} href={`/dashboard/media-archive/clips/${clip.id}`} className="flex items-center gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4 transition hover:border-accent hover:bg-cardHover"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accentDim text-accent">▶</span><span className="min-w-0 flex-1"><strong className="block truncate text-textBright">{clip.title}</strong><small className="mt-1 block text-textMuted">{formatDuration(clip.duration)}</small></span><span className="text-sm font-bold text-accent">Bekijken →</span></Link>)}</div>;
}
function LoadingState() { return <div className="grid min-h-56 place-items-center p-8 text-center text-sm text-textMuted">Wedstrijden en clips laden…</div>; }
function EmptyMessage({ title, detail }: { title: string; detail: string }) { return <div className="grid min-h-56 place-items-center p-8 text-center"><div><span className="text-4xl text-accent" aria-hidden="true">▱</span><p className="mt-3 font-bold text-textPrimary">{title}</p><p className="mt-1 text-sm text-textMuted">{detail}</p></div></div>; }
function EmptyState() { return <div className="grid min-h-56 place-items-center p-8 text-center"><div><span className="text-4xl text-accent" aria-hidden="true">▱</span><p className="mt-3 font-bold text-textPrimary">Deze map is nog leeg</p><p className="mt-1 text-sm text-textMuted">Trainingen zonder betrouwbare seizoen- of ploegkoppeling blijven veilig onder “Niet toegewezen”.</p></div></div>; }
function TreeButton({ active, label, icon, count, open, onToggle, onClick }: { active: boolean; label: string; icon: string; count?: number; open?: boolean; onToggle?: () => void; onClick: () => void }) { return <div className={`treeRow relative flex items-center rounded-lg text-sm transition ${active ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/25" : "text-textSecondary hover:bg-cardHover hover:text-textPrimary"}`}><button type="button" onClick={onToggle ?? onClick} className="grid h-9 w-7 shrink-0 place-items-center">{onToggle ? <span className={`text-[10px] transition ${open ? "rotate-90" : ""}`}>▶</span> : <span className="h-1 w-1 rounded-full bg-borderButton" />}</button><button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left"><FolderIcon kind={icon} open={open} /><span className="truncate font-semibold">{label}</span>{count !== undefined && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-accent/20 text-accent" : "bg-button text-textMuted"}`}>{count}</span>}</button></div>; }
function FolderIcon({ kind, open }: { kind: string; open?: boolean }) { const color = kind === "team" ? "text-amber-400" : kind === "personal" ? "text-emerald-400" : kind === "unassigned" ? "text-textMuted" : "text-accent"; return <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${color}`} fill="currentColor" aria-hidden="true"><path d={open ? "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2H6a2 2 0 0 0-1.9 1.37L2 17V7h1Zm3 4h16l-3 8H4l2-8Z" : "M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"} /></svg>; }
function toggleSet(current: Set<string>, id: string) { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }
function formatSeason(name: string) { const match = name.match(/(20\d{2})\D+(20\d{2})/); return match ? `${match[1]}–${match[2]}` : name.replace(/-/g, "–"); }
function isDefaultOpenSeason(name: string) { return /2026\D+2027/.test(name); }
function formatDuration(seconds: number | null) { if (seconds === null || !Number.isFinite(seconds)) return "Duur onbekend"; const rounded = Math.max(0, Math.round(seconds)); return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`; }
function DocumentIcon() { return <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 2.75h8l4 4v14.5H6z" /><path d="M14 2.75v4h4M8.5 12h7M8.5 15.5h7" /></svg>; }
