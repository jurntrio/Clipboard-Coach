"use client";

import { useEffect, useMemo, useState } from "react";

type Option = { id: string; label: string; option_type: string };
type Training = {
  id: string; player_id: string; player_name: string; training_date: string; start_time: string;
  field_option_id: string | null; locker_room_option_id: string | null; can_update: boolean;
  club_teams: { name: string } | null;
  player_groups?: { name: string; icon: string | null } | null;
  attendance: { attendance_status: "present" | "absent"; absence_reason_id: string | null; note: string | null } | null;
};

export function ContactTrainingAvailability({ playerIds }: { playerIds: string[] }) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void load(); }, []);
  async function load() {
    const response = await fetch("/api/guardian/trainings");
    const body = await response.json().catch(() => null);
    if (response.ok) { setTrainings(body.trainings ?? []); setOptions(body.options ?? []); }
  }
  const rows = useMemo(() => trainings.filter(row => playerIds.includes(row.player_id)), [trainings, playerIds]);
  const names = Object.fromEntries(options.map(option => [option.id, option.label]));
  const reasons = options.filter(option => option.option_type === "non_selection_reason");
  async function save(row: Training, status: "present" | "absent", reasonId: string | null = row.attendance?.absence_reason_id ?? null, note: string | null = row.attendance?.note ?? null) {
    setBusy(`${row.id}:${row.player_id}`); setError("");
    const response = await fetch("/api/guardian/trainings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: row.id, playerId: row.player_id, status, reasonId, note }) });
    const body = await response.json().catch(() => null); setBusy("");
    if (!response.ok) return setError(body?.error || "De beschikbaarheid kon niet worden aangepast.");
    setTrainings(current => current.map(item => item.id === row.id && item.player_id === row.player_id ? { ...item, attendance: body.attendance } : item));
  }
  if (!rows.length) return null;
  return <section className="rounded-xl border border-border bg-cardDeep p-4">
    <h3 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Komende trainingen</h3>
    <p className="mt-1 text-xs text-textMuted">Geef de beschikbaarheid van je gekoppelde speler door.</p>
    {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-4 space-y-3">{rows.map(row => {
      const key = `${row.id}:${row.player_id}`; const absent = row.attendance?.attendance_status === "absent";
      return <div key={key} className="rounded-xl border border-borderSubtle bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><strong className="text-textBright">{new Date(`${row.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })} · {row.start_time.slice(0, 5)}</strong>
            <p className="text-sm text-textMuted">{row.player_groups ? `${row.player_groups.icon ?? "＋"} Extra groep · ${row.player_groups.name}` : row.club_teams?.name} · Veld {names[row.field_option_id ?? ""] ?? "–"} · KK {names[row.locker_room_option_id ?? ""] ?? "–"}</p></div>
          <div className="flex gap-2"><button disabled={!row.can_update || busy === key} onClick={() => void save(row, "present", null, null)} className={`rounded-lg px-3 py-2 text-sm font-bold ${!absent && row.attendance ? "bg-accent text-page" : "border border-borderButton text-textPrimary"}`}>Beschikbaar</button>
            <button disabled={!row.can_update || busy === key} onClick={() => void save(row, "absent")} className={`rounded-lg px-3 py-2 text-sm font-bold ${absent ? "bg-red-500 text-white" : "border border-borderButton text-textPrimary"}`}>Afmelden</button></div>
        </div>
        {absent && <div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={row.attendance?.absence_reason_id ?? ""} disabled={!row.can_update || busy === key} onChange={event => void save(row, "absent", event.target.value || null)} className={inputClass}><option value="">Reden niet bepaald</option>{reasons.map(reason => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</select>
          <input value={row.attendance?.note ?? ""} disabled={!row.can_update || busy === key} onChange={event => setTrainings(current => current.map(item => item.id === row.id && item.player_id === row.player_id ? { ...item, attendance: { attendance_status: "absent", absence_reason_id: item.attendance?.absence_reason_id ?? null, note: event.target.value } } : item))} onBlur={event => void save(row, "absent", row.attendance?.absence_reason_id ?? null, event.target.value)} placeholder="Korte opmerking (optioneel)" className={inputClass} /></div>}
      </div>;
    })}</div>
  </section>;
}

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary disabled:cursor-not-allowed disabled:opacity-60";
