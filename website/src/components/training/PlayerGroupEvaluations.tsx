"use client";

import { useEffect, useState } from "react";

type Player = { id: string; first_name: string; last_name: string };
type Criterion = { id: string; name: string; description: string | null };
type Evaluation = { id: string; criterion_id: string; player_id: string; score: number; note: string | null };

export function PlayerGroupEvaluations({ groupId, sessionId, players }: { groupId: string; sessionId: string; players: Player[] }) {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/player-groups/${groupId}/evaluations?sessionId=${sessionId}`).then(async response => { const body = await response.json(); if (response.ok) { setCriteria(body.criteria ?? []); setEvaluations(body.evaluations ?? []); } }); }, [groupId, sessionId]);
  if (!criteria.length || !players.length) return null;
  async function save(criterionId: string, score: number, note: string) {
    setBusy(criterionId); setError("");
    const response = await fetch(`/api/player-groups/${groupId}/evaluations`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId, criterionId, sessionId, score, note }) });
    const body = await response.json(); setBusy("");
    if (!response.ok) return setError(body.error || "Evaluatie kon niet worden opgeslagen.");
    setEvaluations(current => [...current.filter(item => !(item.player_id === playerId && item.criterion_id === criterionId)), body.evaluation]);
  }
  return <section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-bold text-textBright">Evaluaties Extra groep</h2><p className="mt-1 text-sm text-textMuted">Scores worden toegevoegd aan de historiek van de speler.</p>
    <select value={playerId} onChange={event => setPlayerId(event.target.value)} className="mt-4 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary sm:max-w-sm">{players.map(player => <option key={player.id} value={player.id}>{player.first_name} {player.last_name}</option>)}</select>
    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    <div className="mt-4 space-y-3">{criteria.map(criterion => { const saved = evaluations.find(item => item.player_id === playerId && item.criterion_id === criterion.id); return <EvaluationRow key={`${playerId}:${criterion.id}`} criterion={criterion} saved={saved} busy={busy === criterion.id} onSave={(score, note) => void save(criterion.id, score, note)} />; })}</div>
  </section>;
}

function EvaluationRow({ criterion, saved, busy, onSave }: { criterion: Criterion; saved?: Evaluation; busy: boolean; onSave: (score: number, note: string) => void }) {
  const [score, setScore] = useState(saved?.score ?? 3); const [note, setNote] = useState(saved?.note ?? "");
  useEffect(() => { setScore(saved?.score ?? 3); setNote(saved?.note ?? ""); }, [saved]);
  return <div className="grid gap-2 rounded-xl border border-borderSubtle bg-cardDeep p-3 md:grid-cols-[minmax(150px,1fr)_100px_minmax(180px,1.5fr)_auto]"><div><strong className="text-sm text-textPrimary">{criterion.name}</strong>{criterion.description && <p className="text-xs text-textMuted">{criterion.description}</p>}</div><select value={score} onChange={event => setScore(Number(event.target.value))} className="rounded-lg border border-border bg-input px-2 py-2 text-textPrimary">{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select><input value={note} onChange={event => setNote(event.target.value)} placeholder="Korte toelichting" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /><button type="button" disabled={busy} onClick={() => onSave(score, note)} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : saved ? "Bijwerken" : "Bewaren"}</button></div>;
}
