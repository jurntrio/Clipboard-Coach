"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Player = { id: string; first_name: string; last_name: string };
type Reason = { id: string; label: string };
type Attendance = { player_id: string; attendance_status: "unknown" | "present" | "absent"; absence_reason_id: string | null; note: string | null };

export function TrainingAttendanceList({ sessionId, players, reasons, initial, editable, confirmedAt, initialTrainerInfo }: {
  sessionId: string; players: Player[]; reasons: Reason[]; initial: Attendance[]; editable: boolean;
  confirmedAt: string | null; initialTrainerInfo: string | null;
}) {
  const [rows, setRows] = useState<Record<string, Attendance>>(() => Object.fromEntries(players.map(player => {
    const saved = initial.find(item => item.player_id === player.id);
    return [player.id, saved ?? { player_id: player.id, attendance_status: "present", absence_reason_id: null, note: null }];
  })));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(confirmedAt);
  const [editingAttendance, setEditingAttendance] = useState(!confirmedAt);
  const [trainerInfo, setTrainerInfo] = useState(initialTrainerInfo ?? "");
  const reasonOptions = useMemo(() => reasons.map(reason => <option key={reason.id} value={reason.id}>{reason.label}</option>), [reasons]);
  const reasonLabels = useMemo(() => new Map(reasons.map(reason => [reason.id, reason.label])), [reasons]);

  async function save(playerId: string, patch: Partial<Attendance>) {
    const next = { ...rows[playerId], ...patch };
    setRows(current => ({ ...current, [playerId]: next }));
    setBusy(playerId); setError("");
    try {
      const response = await fetch(`/api/trainings/sessions/${sessionId}/attendance`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, status: next.attendance_status, reasonId: next.absence_reason_id, note: next.note })
      });
      const body = await response.json();
      if (!response.ok) setError(body.error || "Aanwezigheid kon niet worden bewaard.");
    } catch {
      setError("Aanwezigheid kon niet worden bewaard. Controleer je internetverbinding en probeer opnieuw.");
    } finally {
      setBusy("");
    }
  }

  async function saveTrainerInfo() {
    setBusy("trainer-info"); setError("");
    try {
      const response = await fetch(`/api/trainings/sessions/${sessionId}/attendance`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trainer_info", trainerInfo })
      });
      const body = await response.json();
      if (!response.ok) setError(body.error || "Trainerinfo kon niet worden bewaard.");
    } catch {
      setError("Trainerinfo kon niet worden bewaard. Controleer je internetverbinding en probeer opnieuw.");
    } finally {
      setBusy("");
    }
  }
  async function confirmAttendance() {
    setBusy("confirm"); setError("");
    try {
      const response = await fetch(`/api/trainings/sessions/${sessionId}/attendance`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm" })
      });
      const body = await response.json();
      if (!response.ok) return setError(body.error || "Aanwezigheden konden niet worden bevestigd.");
      setConfirmed(body.confirmedAt);
      setEditingAttendance(false);
      window.dispatchEvent(new Event("dashboard-badges:refresh"));
    } catch {
      setError("Aanwezigheden konden niet worden bevestigd. Controleer je internetverbinding en probeer opnieuw.");
    } finally {
      setBusy("");
    }
  }

  return <section id="aanwezigheden" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-textBright">Spelerslijst</h2><p className="text-sm text-textMuted">{confirmed ? editingAttendance ? "Je past de bevestigde aanwezigheden aan." : `Aanwezigheden bevestigd op ${new Date(confirmed).toLocaleString("nl-BE")}.` : "Iedereen staat standaard op aanwezig. Pas alleen uitzonderingen aan."}</p></div><div className="flex items-center gap-3"><span className="text-xs text-textMuted">{players.length} spelers</span>{editable && confirmed && !editingAttendance && <button type="button" onClick={() => setEditingAttendance(true)} className="rounded-lg border border-borderButton px-3 py-1.5 text-sm font-bold text-accent">Aanwezigheden aanpassen</button>}</div></div>
    {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {!!players.length && <div className="mt-4 divide-y divide-borderSubtle overflow-hidden rounded-xl border border-borderSubtle bg-cardDeep">{players.map(player => {
      const row = rows[player.id];
      return <div key={player.id} className="grid gap-2 px-3 py-2.5 md:grid-cols-[1fr_150px_220px] md:items-center">
        <Link href={`/dashboard/teams/players/${player.id}`} className="text-sm font-bold text-textPrimary underline decoration-accent/50 underline-offset-4 hover:text-accent">{player.first_name} {player.last_name}</Link>
        {editable && editingAttendance ? <select value={row.attendance_status} onChange={event => void save(player.id, { attendance_status: event.target.value as Attendance["attendance_status"], absence_reason_id: event.target.value === "absent" ? row.absence_reason_id : null })} className={inputClass}>
            <option value="present">Aanwezig</option><option value="absent">Afwezig</option>
          </select> : <strong className={row.attendance_status === "absent" ? "text-red-300" : "text-accent"}>{row.attendance_status === "absent" ? "Afwezig" : "Aanwezig"}</strong>}
        {row.attendance_status === "absent" && editable && editingAttendance ? <select value={row.absence_reason_id ?? ""} onChange={event => void save(player.id, { absence_reason_id: event.target.value || null })} className={inputClass}>
          <option value="">Reden niet bepaald</option>{reasonOptions}
        </select> : <span className="text-xs text-textMuted">{row.attendance_status === "absent" ? reasonLabels.get(row.absence_reason_id ?? "") ?? "Reden niet bepaald" : "Aanwezig"}</span>}
      </div>;
    })}</div>}
    {!players.length && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Er zijn nog geen spelers aan dit team gekoppeld.</p>}
    <div className="mt-5 rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <label className="text-sm font-semibold text-textPrimary">Info van de trainer
        <textarea value={trainerInfo} disabled={!editable} onChange={event => setTrainerInfo(event.target.value)} rows={3} placeholder="Korte info over deze training…" className={`${inputClass} mt-2 resize-y`} />
      </label>
      {editable && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy === "trainer-info"} onClick={() => void saveTrainerInfo()} className="rounded-lg border border-borderButton px-4 py-2 text-sm font-bold text-textPrimary">Info bewaren</button>
        {editingAttendance && <button type="button" disabled={!!busy} onClick={() => void confirmAttendance()} className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page">✓ {confirmed ? "Aanpassingen bevestigen" : "Aanwezigheden bevestigen"}</button>}
      </div>}
    </div>
  </section>;
}

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:cursor-not-allowed disabled:opacity-60";
