"use client";

import { useState } from "react";

type Player = { id: string; first_name: string; last_name: string };
type Reason = { id: string; label: string };
type Attendance = { player_id: string; attendance_status: "unknown" | "present" | "absent"; absence_reason_id: string | null; note: string | null };

export function TrainingAttendanceList({ sessionId, players, reasons, initial, editable }: {
  sessionId: string; players: Player[]; reasons: Reason[]; initial: Attendance[]; editable: boolean;
}) {
  const [rows, setRows] = useState<Record<string, Attendance>>(() => Object.fromEntries(players.map(player => {
    const saved = initial.find(item => item.player_id === player.id);
    return [player.id, saved ?? { player_id: player.id, attendance_status: "unknown", absence_reason_id: null, note: null }];
  })));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function save(playerId: string, patch: Partial<Attendance>) {
    const next = { ...rows[playerId], ...patch };
    setRows(current => ({ ...current, [playerId]: next }));
    setBusy(playerId); setError("");
    const response = await fetch(`/api/trainings/sessions/${sessionId}/attendance`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, status: next.attendance_status, reasonId: next.absence_reason_id, note: next.note })
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) setError(body.error || "Aanwezigheid kon niet worden bewaard.");
  }

  return <section className="rounded-2xl border border-border bg-card p-5">
    <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-textBright">Spelerslijst</h2><p className="text-sm text-textMuted">Aanwezigheid en afwezigheidsreden per speler.</p></div><span className="text-xs text-textMuted">{players.length} spelers</span></div>
    {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-4 space-y-2">{players.map(player => {
      const row = rows[player.id];
      return <div key={player.id} className="grid gap-2 rounded-xl border border-borderSubtle bg-cardDeep p-3 md:grid-cols-[1fr_150px_220px] md:items-center">
        <strong className="text-sm text-textPrimary">{player.first_name} {player.last_name}</strong>
        <select disabled={!editable || busy === player.id} value={row.attendance_status} onChange={event => void save(player.id, { attendance_status: event.target.value as Attendance["attendance_status"], absence_reason_id: event.target.value === "absent" ? row.absence_reason_id : null })} className={inputClass}>
          <option value="unknown">Nog niet aangeduid</option><option value="present">Aanwezig</option><option value="absent">Afwezig</option>
        </select>
        {row.attendance_status === "absent" ? <select disabled={!editable || busy === player.id} value={row.absence_reason_id ?? ""} onChange={event => void save(player.id, { absence_reason_id: event.target.value || null })} className={inputClass}>
          <option value="">Reden niet bepaald</option>{reasons.map(reason => <option key={reason.id} value={reason.id}>{reason.label}</option>)}
        </select> : <span className="text-xs text-textMuted">{row.attendance_status === "present" ? "Bevestigd aanwezig" : "Nog te bevestigen"}</span>}
      </div>;
    })}</div>
    {!players.length && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Er zijn nog geen spelers aan dit team gekoppeld.</p>}
  </section>;
}

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:opacity-60";
