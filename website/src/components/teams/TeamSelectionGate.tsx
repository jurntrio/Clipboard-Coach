"use client";

import { useMemo, useState } from "react";

export function TeamSelectionGate({ teams, destination = "/dashboard" }: {
  teams: Array<{ id: string; name: string }>;
  destination?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => teams.filter(team => team.name.toLocaleLowerCase("nl-BE").includes(query.trim().toLocaleLowerCase("nl-BE"))), [query, teams]);

  async function confirm(clubTeamId: string | null) {
    if (busy) return;
    setBusy(true);
    const response = await fetch("/api/team-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubTeamId })
    });
    if (!response.ok) { setBusy(false); return; }
    window.location.assign(destination);
  }

  return <section className="mx-auto my-8 w-full max-w-4xl rounded-2xl border border-border bg-card p-5 sm:p-7">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-textMuted">Ploegselectie</p>
    <h1 className="mt-1 text-2xl font-bold text-textBright">Welke ploeg wil je bekijken?</h1>
    <p className="mt-2 text-sm text-textMuted">SVS laadt pas gegevens nadat je één ploeg kiest. Zo blijft het dashboard snel, ook bij grote clubs.</p>
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek een ploeg…" className="mt-5 w-full rounded-xl border border-border bg-input px-4 py-3 text-textPrimary" />
    <div className="mt-3 grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-borderSubtle p-2 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map(team => <label key={team.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition hover:bg-cardHover ${selectedId === team.id ? "border-accent bg-accentDim text-accent" : "border-borderSubtle bg-cardDeep text-textPrimary"}`}>
        <input type="radio" name="team-selection" checked={selectedId === team.id} onChange={() => setSelectedId(team.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <span className="min-w-0 flex-1 truncate">{team.name}</span>
      </label>)}
      {!filtered.length && <p className="p-4 text-center text-sm text-textMuted">Geen ploeg gevonden.</p>}
    </div>
    <button type="button" disabled={!selectedId || busy} onClick={() => void confirm(selectedId)} className="mt-4 w-full rounded-xl bg-accent px-4 py-3 font-bold text-page disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Ploeg laden…" : "Toon deze ploeg"}</button>
    <button type="button" disabled={busy} onClick={() => void confirm(null)} className="mt-2 w-full text-center text-sm font-semibold text-textMuted underline decoration-dotted underline-offset-4 hover:text-textPrimary disabled:cursor-not-allowed disabled:opacity-40">Alle ploegen tonen</button>
  </section>;
}
