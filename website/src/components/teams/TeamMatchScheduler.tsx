"use client";

import { useState } from "react";

export function TeamMatchScheduler({ teamId, teamName, readOnly }: {
  teamId: string;
  teamName: string;
  readOnly?: boolean;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [opponent, setOpponent] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !opponent.trim()) return setNotice("Vul een datum en tegenstander in.");
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_a_id: teamId,
        team_a_name: isHome ? teamName : opponent.trim(),
        team_b_name: isHome ? opponent.trim() : teamName,
        match_date: date,
        start_time: time || null,
        status: "scheduled",
        is_home_match: isHome
      })
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response.ok) return setNotice(body?.error || "Wedstrijd kon niet worden toegevoegd.");
    setOpponent("");
    setDate("");
    setTime("");
    setNotice("Wedstrijd toegevoegd.");
  }

  if (readOnly) {
    return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-textMuted">Alleen een clubadmin kan wedstrijden toevoegen.</p>;
  }

  return <form onSubmit={save} className="rounded-xl border border-borderSubtle bg-card p-4">
    <h4 className="font-semibold text-textPrimary">Wedstrijd toevoegen voor {teamName}</h4>
    <p className="mt-1 text-xs text-textMuted">De thuisploeg wordt altijd als eerste weergegeven.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold text-textSecondary">Datum
        <input required type="date" value={date} onChange={event => setDate(event.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-semibold text-textSecondary">Uur
        <input type="time" value={time} onChange={event => setTime(event.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-semibold text-textSecondary md:col-span-2">Tegenstander
        <input required value={opponent} onChange={event => setOpponent(event.target.value)} placeholder="Naam tegenstander" className={inputClass} />
      </label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => setIsHome(true)} className={`rounded-lg px-4 py-2 text-sm font-bold ${isHome ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Thuis</button>
      <button type="button" onClick={() => setIsHome(false)} className={`rounded-lg px-4 py-2 text-sm font-bold ${!isHome ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Uit</button>
    </div>
    <p className="mt-3 rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-sm text-textPrimary">
      {isHome ? `${teamName} – ${opponent || "Tegenstander"}` : `${opponent || "Tegenstander"} – ${teamName}`}
    </p>
    <button disabled={busy} className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-black text-page disabled:opacity-50">
      {busy ? "Toevoegen…" : "Wedstrijd toevoegen"}
    </button>
    {notice && <p className="mt-2 text-sm text-accent">{notice}</p>}
  </form>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal text-textPrimary";
