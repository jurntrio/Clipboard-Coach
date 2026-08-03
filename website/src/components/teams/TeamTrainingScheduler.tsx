"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClubMatchOption } from "@/components/clubs/ClubMatchOptionsManager";
import { recurringDates, type TrainingRecurrence } from "@/lib/training-recurrence";

type Trainer = { id: string; profile_id: string | null; display_name: string };
type Training = {
  id: string; training_date: string; start_time: string;
  field_option_id: string | null; locker_room_option_id: string | null; staff_ids: string[];
};
type DayDraft = { enabled: boolean; time: string; fieldOptionId: string; lockerRoomOptionId: string; staffIds: string[] };

const weekdays = [
  { value: 1, label: "maandag" }, { value: 2, label: "dinsdag" }, { value: 3, label: "woensdag" },
  { value: 4, label: "donderdag" }, { value: 5, label: "vrijdag" }, { value: 6, label: "zaterdag" },
  { value: 0, label: "zondag" }
];
const emptyDay = (staffIds: string[]): DayDraft => ({ enabled: false, time: "18:00", fieldOptionId: "", lockerRoomOptionId: "", staffIds });

export function TeamTrainingScheduler({ teamId, groupId, trainers, assignedTrainerIds, options, readOnly }: {
  teamId?: string; groupId?: string; trainers: Trainer[]; assignedTrainerIds: string[]; options: ClubMatchOption[]; readOnly?: boolean;
}) {
  const endpoint = groupId ? `/api/club/player-groups/${groupId}/trainings` : `/api/club/teams/${teamId}/trainings`;
  const defaultStaffIds = useMemo(() => trainers.filter(item => assignedTrainerIds.includes(item.id)).map(item => item.id), [trainers, assignedTrainerIds]);
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [single, setSingle] = useState({ date: "", time: "18:00", fieldOptionId: "", lockerRoomOptionId: "", staffIds: defaultStaffIds });
  const [days, setDays] = useState<Record<number, DayDraft>>(() => Object.fromEntries(weekdays.map(day => [day.value, emptyDay(defaultStaffIds)])));
  const [range, setRange] = useState({ start: "", end: "" });
  const [recurrence, setRecurrence] = useState<TrainingRecurrence>("weekly");
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const fields = options.filter(option => option.option_type === "field");
  const lockerRooms = options.filter(option => option.option_type === "locker_room");

  async function load() {
    const response = await fetch(endpoint);
    const body = await response.json();
    if (response.ok) setTrainings(body.trainings ?? []);
  }
  useEffect(() => { void load(); }, [endpoint]);

  async function save() {
    setNotice("");
    const sessions = mode === "single"
      ? [{ date: single.date, time: single.time, fieldOptionId: single.fieldOptionId || null, lockerRoomOptionId: single.lockerRoomOptionId || null, staffIds: single.staffIds }]
      : weekdays.flatMap(day => {
          const draft = days[day.value];
          return draft.enabled ? recurringDates(range.start, range.end, day.value, recurrence).map(date => ({
            date, time: draft.time, fieldOptionId: draft.fieldOptionId || null,
            lockerRoomOptionId: draft.lockerRoomOptionId || null, staffIds: draft.staffIds
          })) : [];
        });
    if (!sessions.length || sessions.some(item => !item.date || !item.time)) return setNotice("Kies een datum, uur en minstens één trainingsdag.");
    setBusy(true);
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions, series: mode === "multiple" })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "Trainingen konden niet worden toegevoegd.");
    setNotice(`${sessions.length} training${sessions.length === 1 ? "" : "en"} toegevoegd.`);
    await load();
  }

  async function remove(id: string) {
    setBusy(true); setNotice("");
    const response = await fetch(endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainingId: id })
    });
    setBusy(false);
    if (!response.ok) return setNotice("Training kon niet worden verwijderd.");
    await load();
  }

  const optionLabel = (id: string | null) => options.find(option => option.id === id)?.label;
  return <div className="space-y-4">
    {!readOnly && <section className="rounded-xl border border-borderSubtle bg-card p-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("single")} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "single" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>1 training</button>
        <button type="button" onClick={() => setMode("multiple")} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "multiple" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Meerdere trainingen</button>
      </div>
      {mode === "single" ? <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Labeled label="Datum"><input type="date" value={single.date} onChange={event => setSingle(current => ({ ...current, date: event.target.value }))} className={inputClass} /></Labeled>
        <Labeled label="Uur"><input type="time" value={single.time} onChange={event => setSingle(current => ({ ...current, time: event.target.value }))} className={inputClass} /></Labeled>
        <OptionSelect label="Veld" value={single.fieldOptionId} options={fields} onChange={value => setSingle(current => ({ ...current, fieldOptionId: value }))} />
        <OptionSelect label="Kleedkamer" value={single.lockerRoomOptionId} options={lockerRooms} onChange={value => setSingle(current => ({ ...current, lockerRoomOptionId: value }))} />
        <div className="md:col-span-2"><StaffSelect trainers={trainers} value={single.staffIds} onChange={staffIds => setSingle(current => ({ ...current, staffIds }))} /></div>
      </div> : <div className="mt-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Labeled label="Begindatum"><input type="date" value={range.start} onChange={event => setRange(current => ({ ...current, start: event.target.value }))} className={inputClass} /></Labeled>
          <Labeled label="Einddatum"><input type="date" value={range.end} min={range.start} onChange={event => setRange(current => ({ ...current, end: event.target.value }))} className={inputClass} /></Labeled>
          <Labeled label="Herhaling"><select value={recurrence} onChange={event => setRecurrence(event.target.value as TrainingRecurrence)} className={inputClass}>
            <option value="weekly">Wekelijks</option>
            <option value="biweekly">Om de twee weken</option>
            <option value="monthly">Maandelijks</option>
          </select></Labeled>
        </div>
        {recurrence === "monthly" && <p className="mt-2 text-xs text-textMuted">Maandelijks gebruikt dezelfde positie van de gekozen weekdag, bijvoorbeeld de eerste zaterdag van elke maand.</p>}
        <div className="mt-4 space-y-3">{weekdays.map(day => {
          const draft = days[day.value];
          return <div key={day.value} className="rounded-xl border border-borderSubtle p-3">
            <label className="flex items-center gap-2 font-semibold capitalize text-textPrimary"><input type="checkbox" checked={draft.enabled} onChange={event => setDays(current => ({ ...current, [day.value]: { ...draft, enabled: event.target.checked } }))} className="accent-accent" />{day.label}</label>
            {draft.enabled && <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Labeled label="Uur"><input type="time" value={draft.time} onChange={event => setDays(current => ({ ...current, [day.value]: { ...draft, time: event.target.value } }))} className={inputClass} /></Labeled>
              <OptionSelect label="Veld" value={draft.fieldOptionId} options={fields} onChange={fieldOptionId => setDays(current => ({ ...current, [day.value]: { ...draft, fieldOptionId } }))} />
              <OptionSelect label="Kleedkamer" value={draft.lockerRoomOptionId} options={lockerRooms} onChange={lockerRoomOptionId => setDays(current => ({ ...current, [day.value]: { ...draft, lockerRoomOptionId } }))} />
              <div className="md:col-span-3"><StaffSelect trainers={trainers} value={draft.staffIds} onChange={staffIds => setDays(current => ({ ...current, [day.value]: { ...draft, staffIds } }))} /></div>
            </div>}
          </div>;
        })}</div>
      </div>}
      <button type="button" disabled={busy} onClick={() => void save()} className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-black text-page disabled:opacity-50">{busy ? "Bewaren…" : "Trainingen toevoegen"}</button>
      {notice && <p className="mt-2 text-sm text-accent">{notice}</p>}
    </section>}
    <section className="rounded-xl border border-borderSubtle p-4">
      <h4 className="font-semibold text-textPrimary">Wedstrijden en trainingen van dit team</h4>
      <p className="mt-1 text-xs text-textMuted">Wedstrijden blijven automatisch via de kalender binnenkomen; hieronder staan de geplande trainingen.</p>
      <div className="mt-3 space-y-2">{trainings.map(training => <div key={training.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-lg">⚽</span>
        <span className="min-w-0 flex-1"><strong className="block text-sm text-textBright">Training · {new Date(`${training.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}</strong>
          <span className="text-xs text-textMuted">{training.start_time.slice(0, 5)}{optionLabel(training.field_option_id) ? ` · ${optionLabel(training.field_option_id)}` : ""}{optionLabel(training.locker_room_option_id) ? ` · ${optionLabel(training.locker_room_option_id)}` : ""}</span>
        </span>
        <span className="text-xs text-textSecondary">{training.staff_ids.map(id => trainers.find(person => person.id === id)?.display_name).filter(Boolean).join(", ")}</span>
        {!readOnly && <button type="button" disabled={busy} onClick={() => void remove(training.id)} className="text-sm text-red-300">Verwijderen</button>}
      </div>)}</div>
      {!trainings.length && <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-textMuted">Nog geen trainingen gepland.</p>}
    </section>
  </div>;
}

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm text-textSecondary"><span className="mb-1 block font-semibold">{label}</span>{children}</label>;
}
function OptionSelect({ label, value, options, onChange }: { label: string; value: string; options: ClubMatchOption[]; onChange: (value: string) => void }) {
  return <Labeled label={label}><select value={value} onChange={event => onChange(event.target.value)} className={inputClass}><option value="">Niet bepaald</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Labeled>;
}
function StaffSelect({ trainers, value, onChange }: { trainers: Trainer[]; value: string[]; onChange: (value: string[]) => void }) {
  return <fieldset><legend className="mb-1 text-sm font-semibold text-textSecondary">Staff</legend><div className="flex flex-wrap gap-2">{trainers.map(person => <label key={person.id} className="flex items-center gap-2 rounded-lg border border-borderSubtle px-3 py-2 text-sm text-textPrimary"><input type="checkbox" checked={value.includes(person.id)} onChange={() => onChange(value.includes(person.id) ? value.filter(id => id !== person.id) : [...value, person.id])} className="accent-accent" />{person.display_name}</label>)}</div></fieldset>;
}
