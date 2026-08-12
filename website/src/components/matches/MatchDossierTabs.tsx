"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchLineupEditor, type LineupBlock, type LineupPosition } from "./MatchLineupEditor";

export type MatchDossier = {
  lineup_notes: string;
  general_report: string;
  positives: string;
  improvements: string;
  highlights: string;
  goals: string;
  cards: string;
  chances: string;
  scouting: string;
  goal_events: GoalEvent[];
  lineup_positions: LineupPosition[];
  lineup_blocks: LineupBlock[];
  player_reviews: PlayerReview[];
};

type PlayerReview = { playerId: string; rating: number | null; report: string; playerReport: string };

type Player = { id: string; first_name: string; last_name: string; jersey_number: number | null; is_goalkeeper?: boolean };
type Clip = { id: string; name: string; render_status: string; created_at: string; shareToken: string | null };
type GoalEvent = {
  id: string; team: "home" | "away"; scoreAfter: string; minute: number | null;
  scorerType: "" | "player" | "own_goal" | "custom"; scorerPlayerId: string; scorerName: string;
  assistType: "player" | "own_goal" | "custom" | "none"; assistPlayerId: string; assistName: string;
  description: string;
};

const emptyDossier: MatchDossier = {
  lineup_notes: "", general_report: "", positives: "", improvements: "",
  highlights: "", goals: "", cards: "", chances: "", scouting: "", goal_events: [], lineup_positions: [], lineup_blocks: [], player_reviews: []
};

export function MatchDossierTabs({ matchId, players, reportPlayers = players, clips, initialDossier, editable, canComplete = false, scoutingEditable = false, played, scoreA, scoreB, ownTeamSide, homeTeamName, awayTeamName, completed, matchPeriodCount, matchPeriodMinutes, showSelection = true, showReport = false, showScouting = false }: {
  matchId: string; players: Player[]; reportPlayers?: Player[]; clips: Clip[]; initialDossier?: Partial<MatchDossier> | null; editable: boolean;
  canComplete?: boolean; scoutingEditable?: boolean; played: boolean; scoreA: number | null; scoreB: number | null; ownTeamSide: "home" | "away"; homeTeamName: string; awayTeamName: string; completed: boolean; matchPeriodCount?: number | null; matchPeriodMinutes?: number | null; showSelection?: boolean; showReport?: boolean; showScouting?: boolean;
}) {
  const router = useRouter();
  const expectedGoals = Array.from({ length: (scoreA ?? 0) + (scoreB ?? 0) }, (_, index) => ({ id: `goal-${index + 1}` }));
  const savedGoals = initialDossier?.goal_events ?? [];
  const normalizedGoals = expectedGoals.map((expected, index) => {
    const saved = savedGoals[index]
      ? { ...newGoal(expected.id), ...savedGoals[index], id: expected.id }
      : newGoal(expected.id);
    if (!saved.scoreAfter && scoreB === 0) return { ...saved, scoreAfter: `${index + 1}-0`, team: "home" as const };
    if (!saved.scoreAfter && scoreA === 0) return { ...saved, scoreAfter: `0-${index + 1}`, team: "away" as const };
    return saved;
  });
  const [draft, setDraft] = useState<MatchDossier>({ ...emptyDossier, ...(initialDossier ?? {}), goal_events: normalizedGoals });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  function field(key: Exclude<keyof MatchDossier, "goal_events" | "lineup_positions" | "lineup_blocks" | "player_reviews">, label: string, placeholder: string) {
    if (!editable && !draft[key].trim()) return null;
    if (!editable) return <div>
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-textMuted">{label}</span>
      <p className="whitespace-pre-wrap text-sm text-textPrimary">{draft[key]}</p>
    </div>;
    return <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-textMuted">{label}</span>
      <textarea value={draft[key]} disabled={!editable} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}
        placeholder={placeholder} rows={4} className="w-full resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:opacity-70" />
    </label>;
  }

  function goalValidationError() {
    if (!played || scoreA == null || scoreB == null) return "";
    let previousA = 0;
    let previousB = 0;
    for (let index = 0; index < draft.goal_events.length; index += 1) {
      const next = parseScore(draft.goal_events[index].scoreAfter);
      if (!next || !((next.a === previousA + 1 && next.b === previousB) || (next.a === previousA && next.b === previousB + 1))) {
        return `Doelpunt ${index + 1}: vul een geldige volgende stand in.`;
      }
      previousA = next.a;
      previousB = next.b;
    }
    return previousA === scoreA && previousB === scoreB ? "" : `De laatste stand moet ${scoreA}-${scoreB} zijn.`;
  }

  async function save(complete = false) {
    if (complete && !editable) {
      setSaving(true); setNotice("");
      const completeResponse = await fetch(`/api/matches/${matchId}/dossier`, { method: "POST" });
      const completeBody = await completeResponse.json().catch(() => null) as { error?: string } | null;
      setSaving(false);
      if (!completeResponse.ok) return setNotice(completeBody?.error || "Wedstrijd kon niet worden afgewerkt.");
      setNotice("Wedstrijd afgewerkt."); router.refresh(); return;
    }
    const validationError = goalValidationError();
    if (validationError) return setNotice(validationError);
    setSaving(true);
    setNotice("");
    const response = await fetch(`/api/matches/${matchId}/dossier`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft)
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setSaving(false); return setNotice(body?.error || "Bewaren is mislukt."); }
    window.dispatchEvent(new Event("dashboard-badges:refresh"));
    if (complete) {
      const completeResponse = await fetch(`/api/matches/${matchId}/dossier`, { method: "POST" });
      const completeBody = await completeResponse.json().catch(() => null) as { error?: string } | null;
      setSaving(false);
      if (!completeResponse.ok) return setNotice(completeBody?.error || "Wedstrijd kon niet worden afgewerkt.");
      setNotice("Wedstrijd afgewerkt.");
      router.refresh();
      return;
    }
    setSaving(false);
    setNotice("Wedstrijddossier bewaard.");
  }

  const savedLineupBlocks = draft.lineup_blocks.length > 0 ? draft.lineup_blocks : [{ id: "block-0", startMinute: 0, positions: draft.lineup_positions }];
  const expectedBlockStarts = matchPeriodCount && matchPeriodMinutes
    ? Array.from({ length: matchPeriodCount }, (_, index) => index * matchPeriodMinutes)
    : [0];
  const lineupBlocks = [
    ...savedLineupBlocks,
    ...expectedBlockStarts.filter(startMinute => !savedLineupBlocks.some(block => block.startMinute === startMinute)).map(startMinute => ({
      id: `period-${startMinute}`,
      startMinute,
      positions: savedLineupBlocks.filter(block => block.startMinute < startMinute).sort((a, b) => b.startMinute - a.startMinute)[0]?.positions.map(position => ({ ...position })) ?? []
    }))
  ].sort((a, b) => a.startMinute - b.startMinute);
  const hasReport = editable || [draft.general_report, draft.positives, draft.improvements, draft.highlights, draft.cards, draft.chances].some(value => value.trim()) || draft.goal_events.length > 0;
  const dossierClass = played ? "overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border" : "space-y-3";

  return <section className={dossierClass}>
    {(editable || !!draft.lineup_notes.trim() || lineupBlocks.some(block => block.positions.length > 0)) && <ClosedPanel title="Opstelling" expanded={played}>
      <div className="space-y-4">
        <MatchLineupEditor players={reportPlayers} blocks={lineupBlocks} editable={editable}
          onChange={lineup_blocks => setDraft(current => ({ ...current, lineup_blocks }))} />
        {field("lineup_notes", "Notities bij de opstelling", "Noteer de formatie, posities en wissels…")}
      </div>
    </ClosedPanel>}

    {played && showReport && hasReport && <div id="wedstrijdverslag" className="scroll-mt-24"><ClosedPanel title="Wedstrijdverslag" expanded>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">{field("general_report", "Algemeen wedstrijdverslag", "Beschrijf het wedstrijdverloop…")}</div>
        {field("positives", "Pluspunten", "Wat liep goed?")}
        {field("improvements", "Werkpunten", "Wat moet beter?")}
        {field("highlights", "Hoogtepunten", "Belangrijke momenten…")}
        <div className="md:col-span-2">
          <GoalEditor goals={draft.goal_events} players={reportPlayers} ownTeamSide={ownTeamSide} homeTeamName={homeTeamName}
            awayTeamName={awayTeamName} editable={editable} onChange={goal_events => setDraft(current => ({ ...current, goal_events }))} />
        </div>
        {field("cards", "Kaarten", "Gele en rode kaarten…")}
        {field("chances", "Kansen", "Grote kansen en gemiste mogelijkheden…")}
      </div>
    </ClosedPanel></div>}

    {showSelection && (players.length > 0 || editable) && <ClosedPanel title={`Spelersbeoordeling (${players.length})`} expanded={played}>
      <p className="mb-4 rounded-lg border border-borderSubtle bg-cardDeep p-3 text-xs text-textMuted">Intern: nooit zichtbaar voor spelers of contactpersonen.</p>
      {players.length ? <div className="overflow-hidden rounded-xl border border-borderSubtle">
        {players.map(player => {
          const savedReview = draft.player_reviews.find(item => item.playerId === player.id);
          const review: PlayerReview = { playerId: player.id, rating: savedReview?.rating ?? null, report: savedReview?.report ?? "", playerReport: savedReview?.playerReport ?? "" };
          const updateReview = (patch: Partial<PlayerReview>) => setDraft(current => ({ ...current, player_reviews: [...current.player_reviews.filter(item => item.playerId !== player.id), { ...review, ...patch }] }));
          return <div key={player.id} className="grid gap-3 border-b border-borderSubtle bg-cardDeep p-3 last:border-b-0 md:grid-cols-[minmax(180px,1fr)_110px_2fr_2fr] md:items-center">
            <strong className="text-sm text-textBright">{player.jersey_number != null && <span className="mr-2 text-accent">{player.jersey_number}</span>}{player.first_name} {player.last_name}</strong>
            <label className="text-xs font-bold text-textSecondary">Punten / 10<input type="number" min={0} max={10} step={0.5} disabled={!editable} value={review.rating ?? ""} onChange={event => updateReview({ rating: event.target.value === "" ? null : Math.max(0, Math.min(10, Number(event.target.value))) })} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary disabled:opacity-70" /></label>
            {editable
              ? <label className="text-xs font-bold text-textSecondary">Individueel verslag<textarea rows={3} value={review.report} onChange={event => updateReview({ report: event.target.value })} placeholder="Korte interne beoordeling…" className="mt-1 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary" /></label>
              : <ReviewText label="Individueel verslag" value={review.report} />}
            {editable
              ? <label className="text-xs font-bold text-textSecondary">Beoordeling voor speler<textarea rows={3} value={review.playerReport} onChange={event => updateReview({ playerReport: event.target.value })} placeholder="Feedback voor de speler…" className="mt-1 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary" /></label>
              : <ReviewText label="Beoordeling voor speler" value={review.playerReport} />}
          </div>;
        })}
      </div> : <Empty text="Nog geen spelers geselecteerd." />}
    </ClosedPanel>}

    {played && showScouting && (scoutingEditable || !!draft.scouting.trim()) && <ClosedPanel title="Scouting" expanded>
      {scoutingEditable ? <label className="block"><span className="mb-1 block text-xs font-black uppercase tracking-wide text-textMuted">Scouting</span>
        <textarea value={draft.scouting} onChange={event => setDraft(current => ({ ...current, scouting: event.target.value }))}
          placeholder="Observaties over eigen spelers, tegenstander en aandachtspunten…" rows={4} className="w-full resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
      </label> : field("scouting", "Scouting", "Observaties over eigen spelers, tegenstander en aandachtspunten…")}
    </ClosedPanel>}

    {(clips.length > 0 || editable) && <ClosedPanel title={`Clips (${clips.length})`} expanded={false}>
      {clips.length ? <div className="grid gap-3 sm:grid-cols-2">
        {clips.map(clip => <article key={clip.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
          <strong className="block text-textBright">{clip.name}</strong>
          <span className="mt-1 block text-xs text-textMuted">{new Date(clip.created_at).toLocaleDateString("nl-BE")} · {clip.render_status}</span>
          {clip.shareToken && <Link href={`/share/${clip.shareToken}`} className="mt-3 inline-flex text-sm font-bold text-accent">Clip openen</Link>}
        </article>)}
      </div> : <Empty text="Nog geen clips voor deze wedstrijd. Bij een verplaatsing blijft dit vaak leeg." />}
    </ClosedPanel>}

    {(editable || canComplete || scoutingEditable) && <div className="flex flex-wrap items-center justify-end gap-3 p-5">
      {notice && <p className="mr-auto text-sm text-accent">{notice}</p>}
      {canComplete && played && !completed && <button type="button" disabled={saving} onClick={() => void save(true)} className="rounded-lg border border-accent px-5 py-2.5 text-sm font-black text-accent disabled:opacity-50">
        Afgewerkt
      </button>}
      {(editable || scoutingEditable) && <button type="button" disabled={saving} onClick={() => void save(false)} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-black text-page disabled:opacity-50">
        {saving ? "Bewaren…" : "Wedstrijddossier bewaren"}
      </button>}
    </div>}
  </section>;
}

function ReviewText({ label, value }: { label: string; value: string }) {
  return <div className="self-stretch text-xs font-bold text-textSecondary">
    <span>{label}</span>
    <p className="mt-1 whitespace-pre-wrap rounded-lg border border-borderSubtle bg-card px-3 py-2 text-sm font-normal leading-relaxed text-textPrimary">{value.trim() || "—"}</p>
  </div>;
}

function newGoal(id: string): GoalEvent {
  return { id, team: "home", scoreAfter: "", minute: null, scorerType: "", scorerPlayerId: "", scorerName: "", assistType: "none", assistPlayerId: "", assistName: "", description: "" };
}

function parseScore(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  return match ? { a: Number(match[1]), b: Number(match[2]) } : null;
}

function GoalEditor({ goals, players, ownTeamSide, homeTeamName, awayTeamName, editable, onChange }: {
  goals: GoalEvent[]; players: Player[]; ownTeamSide: "home" | "away"; homeTeamName: string; awayTeamName: string;
  editable: boolean; onChange: (goals: GoalEvent[]) => void;
}) {
  function update(id: string, patch: Partial<GoalEvent>) {
    onChange(goals.map(goal => goal.id === id ? { ...goal, ...patch } : goal));
  }
  if (!goals.length) return <Empty text="Geen doelpunten in deze wedstrijd." />;
  if (!editable) {
    const playerName = (id: string) => {
      const player = players.find(item => item.id === id);
      return player ? `${player.first_name} ${player.last_name}`.trim() : "";
    };
    const personLabel = (type: string, playerId: string, name: string, assist = false) =>
      type === "player" ? playerName(playerId) : type === "own_goal" ? (assist ? "Via tegenstander" : "Owngoal") : type === "custom" ? name.trim() : "";
    const visibleGoals = goals.flatMap((goal, index) => {
      const score = parseScore(goal.scoreAfter);
      if (!score) return [];
      return [{ goal, score, index }];
    });
    if (!visibleGoals.length) return null;
    return <div>
      <h4 className="text-xs font-black uppercase tracking-wide text-textMuted">Doelpunten</h4>
      <div className="mt-2 space-y-2">{visibleGoals.map(({ goal, score, index }) => {
        const scorer = personLabel(goal.scorerType, goal.scorerPlayerId, goal.scorerName);
        const assist = personLabel(goal.assistType, goal.assistPlayerId, goal.assistName, true);
        return <div key={`${score.a}-${score.b}-${index}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2">
          <strong className="text-textBright">{score.a}–{score.b}</strong>
          {goal.minute !== null && <span className="text-sm text-textSecondary">{goal.minute}&apos;</span>}
          {scorer && <span className="text-sm text-textPrimary">Doelpunt: <strong>{scorer}</strong></span>}
          {assist && <span className="text-sm text-textSecondary">Assist: {assist}</span>}
          {goal.description?.trim() && <p className="basis-full whitespace-pre-wrap text-sm text-textSecondary">{goal.description}</p>}
        </div>;
      })}</div>
    </div>;
  }
  return <div>
    <h4 className="text-xs font-black uppercase tracking-wide text-textMuted">Doelpunten ({goals.length})</h4>
    <div className="mt-2 space-y-3">{goals.map((goal, index) => {
      const previous = index === 0 ? { a: 0, b: 0 } : parseScore(goals[index - 1].scoreAfter);
      const current = parseScore(goal.scoreAfter);
      const scoringSide: "home" | "away" | null = previous && current
        ? current.a === previous.a + 1 && current.b === previous.b ? "home"
          : current.a === previous.a && current.b === previous.b + 1 ? "away" : null
        : null;
      const ownGoal = scoringSide === ownTeamSide;
      const teamName = scoringSide === "home" ? homeTeamName : scoringSide === "away" ? awayTeamName : "Stand nog invullen";
      return <article key={goal.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-textBright">Doelpunt {index + 1} · {teamName}</strong>
          <fieldset className="flex items-center gap-2 text-xs font-bold text-textSecondary"><legend className="sr-only">Stand na doelpunt</legend>
            <span>Stand</span>
            <input type="number" min={0} value={current?.a ?? previous?.a ?? 0} disabled={!editable || !previous}
              aria-label={`Doelpunten ${homeTeamName} na doelpunt ${index + 1}`}
              onChange={event => { const a = Math.max(0, Number(event.target.value)); const b = current?.b ?? previous?.b ?? 0; update(goal.id, { scoreAfter: `${a}-${b}`, team: previous && a === previous.a + 1 ? "home" : "away" }); }}
              className="w-16 rounded-lg border border-border bg-input px-2 py-1.5 text-center text-textPrimary" />
            <span>–</span>
            <input type="number" min={0} value={current?.b ?? previous?.b ?? 0} disabled={!editable || !previous}
              aria-label={`Doelpunten ${awayTeamName} na doelpunt ${index + 1}`}
              onChange={event => { const a = current?.a ?? previous?.a ?? 0; const b = Math.max(0, Number(event.target.value)); update(goal.id, { scoreAfter: `${a}-${b}`, team: previous && b === previous.b + 1 ? "away" : "home" }); }}
              className="w-16 rounded-lg border border-border bg-input px-2 py-1.5 text-center text-textPrimary" />
          </fieldset>
          <label className="text-xs font-bold text-textSecondary">Minuut
            <input type="number" min={0} max={120} value={goal.minute ?? ""} disabled={!editable}
              onChange={event => update(goal.id, { minute: event.target.value === "" ? null : Math.max(0, Math.min(120, Number(event.target.value))) })}
              className="ml-2 w-20 rounded-lg border border-border bg-input px-2 py-1.5 text-textPrimary" />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {scoringSide === null ? null : ownGoal
            ? <PersonChoice label="Doelpuntenmaker" type={goal.scorerType} playerId={goal.scorerPlayerId} name={goal.scorerName}
                players={players} editable={editable} allowNone={false}
                onChange={patch => update(goal.id, { scorerType: patch.type as GoalEvent["scorerType"], scorerPlayerId: patch.playerId, scorerName: patch.name })} />
            : <TextPerson label="Doelpuntenmaker tegenstander" value={goal.scorerName} editable={editable} onChange={scorerName => update(goal.id, { scorerType: "custom", scorerName })} />}
          {scoringSide !== null && (ownGoal
            ? <PersonChoice label="Assist" type={goal.assistType} playerId={goal.assistPlayerId} name={goal.assistName}
                players={players} editable={editable} allowNone
                onChange={patch => update(goal.id, { assistType: patch.type as GoalEvent["assistType"], assistPlayerId: patch.playerId, assistName: patch.name })} />
            : <TextPerson label="Assist tegenstander" value={goal.assistName} editable={editable} onChange={assistName => update(goal.id, { assistType: assistName ? "custom" : "none", assistName })} />)}
          <label className="text-xs font-bold text-textSecondary md:col-span-2">Extra info over het doelpunt
            <textarea rows={2} value={goal.description ?? ""} disabled={!editable}
              onChange={event => update(goal.id, { description: event.target.value })}
              placeholder="Bijvoorbeeld: opbouw, voorzet, afwerking of andere context…"
              className="mt-1 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary disabled:opacity-70" />
          </label>
        </div>
      </article>;
    })}</div>
  </div>;
}

function PersonChoice({ label, type, playerId, name, players, editable, allowNone, onChange }: {
  label: string; type: string; playerId: string; name: string; players: Player[]; editable: boolean; allowNone: boolean;
  onChange: (value: { type: string; playerId: string; name: string }) => void;
}) {
  const value = type === "player" ? `player:${playerId}` : type;
  return <label className="text-xs font-bold text-textSecondary">{label}
    <select value={value} disabled={!editable} onChange={event => {
      const next = event.target.value;
      onChange(next.startsWith("player:") ? { type: "player", playerId: next.slice(7), name: "" } : { type: next, playerId: "", name: "" });
    }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary">
      {allowNone && <option value="none">Geen assist</option>}
      {!allowNone && <option value="">Kies een doelpuntenmaker…</option>}
      {players.map(player => <option key={player.id} value={`player:${player.id}`}>{player.jersey_number != null ? `${player.jersey_number} · ` : ""}{player.first_name} {player.last_name}</option>)}
      <option value="own_goal">{allowNone ? "Via tegenstander" : "Owngoal"}</option>
      <option value="custom">Andere / vrije invoer</option>
    </select>
    {type === "custom" && <input value={name} disabled={!editable} onChange={event => onChange({ type: "custom", playerId: "", name: event.target.value })}
      placeholder="Naam of vrije omschrijving" className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary" />}
  </label>;
}

function TextPerson({ label, value, editable, onChange }: { label: string; value: string; editable: boolean; onChange: (value: string) => void }) {
  return <label className="text-xs font-bold text-textSecondary">{label}
    <input value={value} disabled={!editable} onChange={event => onChange(event.target.value)} placeholder="Naam"
      className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary" />
  </label>;
}

function ClosedPanel({ title, children, expanded = false }: { title: string; children: React.ReactNode; expanded?: boolean }) {
  if (expanded) return <section>
    <h3 className="border-b border-border px-5 py-4 font-black text-textBright">{title}</h3>
    <div className="p-5">{children}</div>
  </section>;
  return <details className="group overflow-hidden rounded-2xl border border-border bg-card">
    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 font-black text-textBright hover:bg-cardHover">
      <span className="text-accent transition group-open:rotate-90">▶</span>
      {title}
    </summary>
    <div className="border-t border-border p-5">{children}</div>
  </details>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-textMuted">{text}</p>;
}
