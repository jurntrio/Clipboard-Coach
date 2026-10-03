"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export type MediaSeason = { id: string; name: string };
export type MediaTeam = { id: string; seasonId: string; name: string };
export type MediaMatch = { id: string; seasonId: string; teamId: string; title: string; opponent: string; date: string | null; scoreA: number | null; scoreB: number | null };
export type MediaCategory = { id: string; name: string; active: boolean; isDefault: boolean };
export type MediaItem = {
  id: string; videoId: string; matchId: string | null; seasonId: string; kind: "clip"; title: string;
  date: string | null; duration: number | null; teamId: string; teamName: string; opponent: string;
  storageProvider: string; categories: MediaCategory[];
};

type Selection = { type: "root" } | { type: "season"; id: string } | { type: "team" | "matches"; id: string } | { type: "match"; id: string };

export function MediaArchive({ seasons, teams, matches, initialCategories, items, canManage }: {
  seasons: MediaSeason[]; teams: MediaTeam[]; matches: MediaMatch[]; initialCategories: MediaCategory[]; items: MediaItem[]; canManage: boolean;
}) {
  const askConfirm = useConfirm();
  const [selection, setSelection] = useState<Selection>({ type: "root" });
  const [expandedSeasons, setExpandedSeasons] = useState(() => new Set(seasons.filter(item => /2026\D+2027/.test(item.name)).map(item => item.id)));
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(() => new Set());
  const [expandedMatchFolders, setExpandedMatchFolders] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "title">("date-desc");
  const [seasonFilters, setSeasonFilters] = useState<string[]>([]);
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [categories, setCategories] = useState(initialCategories);
  const [mediaItems, setMediaItems] = useState(items);
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [notice, setNotice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const matchById = useMemo(() => new Map(matches.map(item => [item.id, item])), [matches]);
  const teamById = useMemo(() => new Map(teams.map(item => [item.id, item])), [teams]);
  const clipCountByMatch = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of mediaItems) if (item.kind === "clip" && item.matchId) counts.set(item.matchId, (counts.get(item.matchId) ?? 0) + 1);
    return counts;
  }, [mediaItems]);
  const matchesWithClips = useMemo(() => matches.filter(match => (clipCountByMatch.get(match.id) ?? 0) > 0), [clipCountByMatch, matches]);
  const selectedMatch = selection.type === "match" ? matchById.get(selection.id) : undefined;
  const selectedTitle = selection.type === "root" ? "Alle media"
    : selection.type === "season" ? seasons.find(item => item.id === selection.id)?.name ?? "Seizoen"
    : selection.type === "team" ? teamById.get(selection.id)?.name ?? "Ploeg"
    : selection.type === "matches" ? `Wedstrijden met clips · ${teamById.get(selection.id)?.name ?? "Ploeg"}`
    : matchById.get(selection.id)?.title ?? "Wedstrijd";

  const visible = useMemo(() => mediaItems.filter(item => {
    const inTree = selection.type === "root" || selection.type === "match" && item.matchId === selection.id && item.kind === "clip"
      || selection.type === "team" && item.teamId === selection.id
      || selection.type === "season" && item.seasonId === selection.id
      || selection.type === "matches" && item.teamId === selection.id && item.kind === "clip" && !!item.matchId;
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    const inQuery = !needle || [item.title, item.teamName, item.opponent, ...item.categories.map(category => category.name)]
      .some(value => value.toLocaleLowerCase("nl-BE").includes(needle));
    return inTree && inQuery
      && (!seasonFilters.length || seasonFilters.includes(item.seasonId))
      && (!teamFilters.length || teamFilters.includes(item.teamId))
      && (!categoryFilters.length || categoryFilters.some(id => item.categories.some(category => category.id === id)));
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title, "nl-BE")
    : sort === "date-asc" ? (a.date ?? "").localeCompare(b.date ?? "")
    : (b.date ?? "").localeCompare(a.date ?? "")), [categoryFilters, mediaItems, query, seasonFilters, selection, sort, teamFilters]);

  async function mutateCategory(payload: Record<string, unknown>) {
    setNotice("");
    const response = await fetch("/api/intradesk/media-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => null) as { category?: MediaCategory; categories?: MediaCategory[]; error?: string } | null;
    if (!response.ok) { setNotice(body?.error || "De categorie kon niet worden opgeslagen."); return null; }
    if (body?.categories) setCategories(body.categories);
    return body;
  }

  async function addCategory() {
    const name = newCategory.trim(); if (!name) return;
    const body = await mutateCategory({ action: "create", name });
    if (body) { setNewCategory(""); setNotice("Categorie toegevoegd."); }
  }

  async function saveRename(id: string) {
    const name = editingName.trim(); if (!name) return;
    const body = await mutateCategory({ action: "rename", id, name });
    if (body) { setEditingId(null); setNotice("Categorie hernoemd."); }
  }

  async function toggleCategory(category: MediaCategory) {
    const action = category.active ? "deactivate" : "activate";
    if (category.active && !(await askConfirm({ message: `Categorie “${category.name}” deactiveren? Bestaande clips behouden hun koppeling.` }))) return;
    const body = await mutateCategory({ action, id: category.id });
    if (body) setNotice(category.active ? "Categorie gedeactiveerd." : "Categorie geactiveerd.");
  }

  async function assignCategory(item: MediaItem, categoryId: string, checked: boolean) {
    const response = await fetch("/api/intradesk/media-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", clipId: item.id, categoryId, assigned: checked }) });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setNotice(body?.error || "De clipcategorie kon niet worden aangepast."); return; }
    const category = categories.find(value => value.id === categoryId);
    if (!category) return;
    setMediaItems(current => current.map(value => value.id !== item.id ? value : {
      ...value, categories: checked ? [...value.categories.filter(entry => entry.id !== categoryId), category] : value.categories.filter(entry => entry.id !== categoryId)
    }));
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Media zoeken</span><span className="pointer-events-none absolute left-3 top-2.5 text-textMuted">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek clip, ploeg, tegenstander of categorie…" className="w-full rounded-xl border border-border bg-input py-2.5 pl-9 pr-3 text-sm text-textPrimary outline-none focus:border-accent" /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFiltersOpen(value => !value)} className="rounded-xl border border-borderButton bg-button px-4 py-2.5 text-sm font-bold text-textPrimary">Filters{seasonFilters.length + teamFilters.length + categoryFilters.length ? ` (${seasonFilters.length + teamFilters.length + categoryFilters.length})` : ""}</button>
        <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-textPrimary"><option value="date-desc">Nieuwste eerst</option><option value="date-asc">Oudste eerst</option><option value="title">Naam A–Z</option></select>
      </div>
    </div>

    {filtersOpen && <div className="grid gap-4 rounded-2xl border border-border bg-cardDeep p-4 md:grid-cols-3">
      <FilterGroup title="Seizoenen" values={seasons} selected={seasonFilters} onChange={setSeasonFilters} />
      <FilterGroup title="Ploegen" values={teams} selected={teamFilters} onChange={setTeamFilters} />
      <FilterGroup title="Categorieën" values={categories.filter(item => item.active)} selected={categoryFilters} onChange={setCategoryFilters} />
    </div>}

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid min-h-[620px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-cardDeep p-3 lg:border-b-0 lg:border-r">
          <TreeRow active={selection.type === "root"} icon="archive" label="Media-archief" count={mediaItems.length} onClick={() => setSelection({ type: "root" })} />
          <div className="treeBranch mt-1 ml-3 pl-4">
            {seasons.map(season => { const seasonTeams = teams.filter(team => team.seasonId === season.id); const open = expandedSeasons.has(season.id); return <div key={season.id}>
              <TreeRow active={selection.type === "season" && selection.id === season.id} open={open} icon="season" label={season.name} onToggle={() => setExpandedSeasons(toggleSet(expandedSeasons, season.id))} onClick={() => setSelection({ type: "season", id: season.id })} />
              {open && <div className="treeBranch ml-4 pl-4">{seasonTeams.map(team => { const teamMatches = matchesWithClips.filter(match => match.teamId === team.id); const teamOpen = expandedTeams.has(team.id); const matchesOpen = expandedMatchFolders.has(team.id); return <div key={team.id}>
                <TreeRow active={selection.type === "team" && selection.id === team.id} open={teamOpen} icon="team" label={team.name} onToggle={() => setExpandedTeams(toggleSet(expandedTeams, team.id))} onClick={() => setSelection({ type: "team", id: team.id })} />
                {teamOpen && <div className="treeBranch ml-4 pl-4">
                  <TreeRow active={selection.type === "matches" && selection.id === team.id} open={matchesOpen} icon="matches" label="Wedstrijden" count={teamMatches.length} onToggle={() => setExpandedMatchFolders(toggleSet(expandedMatchFolders, team.id))} onClick={() => setSelection({ type: "matches", id: team.id })} />
                  {matchesOpen && !!teamMatches.length && <div className="treeBranch ml-4 pl-4">{teamMatches.map(match => <TreeRow key={match.id} active={selection.type === "match" && selection.id === match.id} icon="match" label={match.opponent || match.title} count={clipCountByMatch.get(match.id)} onClick={() => setSelection({ type: "match", id: match.id })} />)}</div>}
                </div>}
              </div>})}</div>}
            </div>; })}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Media-archief</p><h2 className="mt-1 text-xl font-black text-textBright">{selectedMatch ? <MatchTitleLink match={selectedMatch} /> : selectedTitle}</h2></div><span className="text-sm text-textMuted">{selection.type === "matches" ? matchesWithClips.filter(match => match.teamId === selection.id).length : visible.length} resultaat{(selection.type === "matches" ? matchesWithClips.filter(match => match.teamId === selection.id).length : visible.length) === 1 ? "" : "en"}</span></div>
          {selection.type === "matches" ? <MatchCards matches={matchesWithClips.filter(match => match.teamId === selection.id)} clipCounts={clipCountByMatch} onOpen={id => setSelection({ type: "match", id })} /> : <>
          {visible.length ? selection.type === "match" ? <ClipRows items={visible} /> : <div className="grid gap-3 xl:grid-cols-2">{visible.map(item => <MediaCard key={`${item.kind}-${item.id}`} item={item} categories={categories} canManage={canManage} onAssign={assignCategory} />)}</div> : <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border p-8 text-center"><div><span className="text-4xl" aria-hidden="true">▱</span><p className="mt-3 font-bold text-textPrimary">Geen media in deze selectie</p><p className="mt-1 max-w-md text-sm text-textMuted">Voeg wedstrijdbeelden toe via Video Viewer of maak clips vanuit bestaande tags. De bestanden blijven in de gekoppelde opslag; SVS bewaart de archiefcontext.</p></div></div>}</>}
        </div>
      </div>
    </section>

    {canManage && <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Clubbeheer</p><h2 className="mt-1 text-lg font-black text-textBright">Thematische categorieën</h2><p className="mt-1 text-sm text-textMuted">Categorieën zijn metadata: één clip kan in meerdere thema’s voorkomen zonder het videobestand te dupliceren.</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={newCategory} onChange={event => setNewCategory(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void addCategory(); }} placeholder="Nieuwe categorie" className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /><button type="button" onClick={() => void addCategory()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Toevoegen</button></div></div>
      {notice && <p className="mt-3 text-sm text-accent">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{categories.map(category => <span key={category.id} className={`inline-flex items-center overflow-hidden rounded-lg border ${category.active ? "border-borderButton bg-cardDeep" : "border-border bg-button opacity-60"}`}>{editingId === category.id ? <><input autoFocus value={editingName} onChange={event => setEditingName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void saveRename(category.id); if (event.key === "Escape") setEditingId(null); }} className="w-44 bg-input px-3 py-2 text-sm text-textPrimary" /><button type="button" onClick={() => void saveRename(category.id)} className="px-2 text-accent">✓</button></> : <><span className="px-3 py-2 text-sm text-textPrimary">{category.name}</span><button type="button" onClick={() => { setEditingId(category.id); setEditingName(category.name); }} className="border-l border-border px-2 py-2 text-textMuted hover:text-accent" aria-label={`${category.name} hernoemen`}>✎</button><button type="button" onClick={() => void toggleCategory(category)} className="border-l border-border px-2 py-2 text-textMuted hover:text-accent" aria-label={`${category.name} ${category.active ? "deactiveren" : "activeren"}`}>{category.active ? "×" : "+"}</button></>}</span>)}</div>
    </section>}
    <p className="rounded-xl border border-borderSubtle bg-cardDeep px-4 py-3 text-xs text-textMuted">Google Drive-opslag is voorbereid via provider-neutrale bestandsmetadata. Authenticatie, Drive-synchronisatie en beveiligde streaming zijn nog niet gekoppeld; er worden geen openbare Drive-links aangemaakt.</p>
  </div>;
}

function MediaCard({ item, categories, canManage, onAssign }: { item: MediaItem; categories: MediaCategory[]; canManage: boolean; onAssign: (item: MediaItem, categoryId: string, checked: boolean) => void }) {
  return <article className="rounded-xl border border-borderSubtle bg-cardDeep p-4 transition hover:border-accent"><Link href={`/dashboard/media-archive/clips/${item.id}`} className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accentDim text-accent" aria-hidden="true">✂</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold text-textBright">{item.title}</h3><span className="rounded-full border border-borderButton px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-textMuted">Clip</span></div><p className="mt-1 text-sm text-textSecondary">{item.teamName}{item.opponent ? ` · ${item.opponent}` : ""}</p><p className="mt-1 text-xs text-textMuted">{item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString("nl-BE") : "Datum onbekend"} · {formatDuration(item.duration)}</p><span className="mt-3 inline-block text-sm font-bold text-accent">Bekijken →</span></div></div>
    <div className="mt-3 flex flex-wrap gap-1.5">{item.categories.length ? item.categories.map(category => <span key={category.id} className="rounded-full bg-accentDim px-2 py-1 text-xs font-semibold text-accent">{category.name}</span>) : <span className="text-xs text-textMuted">Geen categorieën</span>}</div></Link>
    {canManage && item.kind === "clip" && <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-accent">Categorieën aanpassen</summary><div className="mt-2 grid gap-1 rounded-lg border border-border bg-card p-2 sm:grid-cols-2">{categories.filter(category => category.active).map(category => <label key={category.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-textPrimary hover:bg-cardHover"><input type="checkbox" checked={item.categories.some(value => value.id === category.id)} onChange={event => void onAssign(item, category.id, event.target.checked)} className="accent-accent" />{category.name}</label>)}</div></details>}
  </article>;
}

function ClipRows({ items }: { items: MediaItem[] }) { return <div className="space-y-2">{items.map(item => <Link key={item.id} href={`/dashboard/media-archive/clips/${item.id}`} className="flex items-center gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4 transition hover:border-accent hover:bg-cardHover"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accentDim text-accent">▶</span><span className="min-w-0 flex-1"><strong className="block truncate text-textBright">{item.title}</strong><small className="mt-1 block text-textMuted">{formatDuration(item.duration)}</small></span><span className="text-sm font-bold text-accent">Bekijken →</span></Link>)}</div>; }
function MatchTitleLink({ match }: { match: MediaMatch }) { const score = match.scoreA !== null && match.scoreB !== null ? ` · ${match.scoreA}–${match.scoreB}` : ""; return <Link href={`/dashboard/games/${match.id}#wedstrijdverslag`} className="underline decoration-accent/50 underline-offset-4 hover:text-accent">{match.title}{score}</Link>; }

function MatchCards({ matches, clipCounts, onOpen }: { matches: MediaMatch[]; clipCounts: Map<string, number>; onOpen: (id: string) => void }) {
  if (!matches.length) return <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border p-8 text-center"><div><span className="text-4xl text-sky-400" aria-hidden="true">▱</span><p className="mt-3 font-bold text-textPrimary">Nog geen wedstrijden met clips</p><p className="mt-1 text-sm text-textMuted">Een wedstrijd verschijnt hier zodra er minstens één clip aan gekoppeld is.</p></div></div>;
  return <div className="grid gap-3 xl:grid-cols-2">{matches.map(match => { const count = clipCounts.get(match.id) ?? 0; return <article key={match.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-400" aria-hidden="true">▶</span><div className="min-w-0 flex-1"><h3 className="font-bold text-textBright"><MatchTitleLink match={match} /></h3><p className="mt-1 text-xs text-textMuted">{match.date ? new Date(`${match.date}T12:00:00`).toLocaleDateString("nl-BE") : "Datum onbekend"} · {count} clip{count === 1 ? "" : "s"}</p></div></div><button type="button" onClick={() => onOpen(match.id)} className="mt-4 inline-flex rounded-lg border border-borderButton px-3 py-2 text-sm font-bold text-textPrimary hover:border-accent hover:text-accent">Bekijk alle {count} clip{count === 1 ? "" : "s"} →</button></article>; })}</div>;
}

function FilterGroup({ title, values, selected, onChange }: { title: string; values: Array<{ id: string; name: string }>; selected: string[]; onChange: (value: string[]) => void }) {
  return <fieldset><legend className="mb-2 text-xs font-black uppercase tracking-wide text-textMuted">{title}</legend><div className="max-h-36 space-y-1 overflow-y-auto">{values.map(value => <label key={value.id} className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={selected.includes(value.id)} onChange={() => onChange(selected.includes(value.id) ? selected.filter(id => id !== value.id) : [...selected, value.id])} className="accent-accent" />{value.name}</label>)}</div></fieldset>;
}

function TreeRow({ active, open, icon, label, count, onToggle, onClick }: { active: boolean; open?: boolean; icon: string; label: string; count?: number; onToggle?: () => void; onClick: () => void }) {
  return <div className={`treeRow relative flex items-center rounded-lg text-sm transition ${active ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/25" : "text-textSecondary hover:bg-cardHover hover:text-textPrimary"}`}><button type="button" onClick={onToggle ?? onClick} className="grid h-9 w-7 shrink-0 place-items-center" aria-label={onToggle ? `${label} ${open ? "inklappen" : "uitklappen"}` : undefined}>{onToggle ? <span className={`text-[10px] transition ${open ? "rotate-90" : ""}`}>▶</span> : <span className="h-1 w-1 rounded-full bg-borderButton" />}</button><button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left"><TreeIcon kind={icon} open={open} /><span className="truncate font-semibold">{label}</span>{count !== undefined && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-accent/20 text-accent" : "bg-button text-textMuted"}`}>{count}</span>}</button></div>;
}

function TreeIcon({ kind, open }: { kind: string; open?: boolean }) { const folder = !["match", "training"].includes(kind); const color = kind === "training" ? "text-emerald-400" : kind === "clips" ? "text-violet-400" : kind === "matches" || kind === "match" ? "text-sky-400" : kind === "team" ? "text-amber-400" : "text-accent"; return folder ? <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${color}`} fill="currentColor" aria-hidden="true"><path d={open ? "M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2H6a2 2 0 0 0-1.9 1.37L2 17V7h1Zm3 4h16l-3 8H4l2-8Z" : "M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"} /></svg> : <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${color}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={kind === "training" ? "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" : "M8 5h11v14H8M5 8l-3 4 3 4"} /></svg>; }

function toggleSet(current: Set<string>, id: string) { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }
function formatDuration(seconds: number | null) { if (seconds === null || !Number.isFinite(seconds)) return "Duur onbekend"; const rounded = Math.max(0, Math.round(seconds)); return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`; }
