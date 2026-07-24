"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PublicMatch = { id: string; team_a_name: string; team_b_name: string; match_date: string | null; start_time: string | null; status: string; live_tag_names: string[] };
type PublicPlayer = { id: string; first_name: string; last_name: string; jersey_number: number | null };

export default function LiveTagPage() {
  const { token } = useParams<{ token: string }>();
  const [match, setMatch] = useState<PublicMatch | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [taggerName, setTaggerName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch(`/api/live-tag/${token}`).then(async (response) => {
      if (!response.ok) throw new Error("Deze taglink is niet beschikbaar.");
      return response.json();
    }).then((data) => { setMatch(data.match); setPlayers(data.players); }).catch((error) => setMessage(error.message));
  }, [token]);

  async function addTag(tagName: string) {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/live-tag/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagName, playerIds: selectedPlayerIds, taggerName })
    });
    setSaving(false);
    if (!response.ok) { setMessage("De tag kon niet worden opgeslagen."); return; }
    setMessage(`${tagName} opgeslagen om ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
  }

  if (!match) return <main className="grid min-h-screen place-items-center bg-page p-6 text-textPrimary">{message || "Wedstrijd laden…"}</main>;
  return (
    <main className="min-h-screen bg-page px-4 py-6 text-textPrimary">
      <div className="mx-auto max-w-lg">
        <header className="mb-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Live taggen</p>
          <h1 className="mt-2 text-2xl font-bold text-textBright">{match.team_a_name} – {match.team_b_name}</h1>
          <p className="mt-1 text-sm text-textMuted">{match.match_date}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p>
        </header>
        <label className="mb-5 block text-sm text-textSecondary">Jouw naam (optioneel)
          <input value={taggerName} onChange={(event) => setTaggerName(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 text-textPrimary" placeholder="Naam tagger" />
        </label>
        {!!players.length && <section className="mb-6"><h2 className="mb-2 text-sm font-semibold text-textBright">Speler aanduiden</h2><div className="flex flex-wrap gap-2">{players.map((player) => { const selected = selectedPlayerIds.includes(player.id); return <button key={player.id} type="button" onClick={() => setSelectedPlayerIds((current) => selected ? current.filter((id) => id !== player.id) : [...current, player.id])} className={`rounded-full border px-3 py-2 text-sm ${selected ? "border-accent bg-accentDim text-accent" : "border-borderButton bg-button"}`}>{player.jersey_number ? `${player.jersey_number} · ` : ""}{player.first_name} {player.last_name}</button>; })}</div></section>}
        <section><h2 className="mb-3 text-sm font-semibold text-textBright">Moment toevoegen</h2><div className="grid grid-cols-2 gap-3">{match.live_tag_names.map((name) => <button key={name} type="button" disabled={saving} onClick={() => void addTag(name)} className="min-h-20 rounded-2xl border border-accent/40 bg-accentDim px-4 py-4 text-lg font-bold text-textBright active:scale-95 disabled:opacity-50">{name}</button>)}</div></section>
        {message && <p className="mt-5 rounded-xl border border-border bg-card p-3 text-center text-sm" role="status">{message}</p>}
      </div>
    </main>
  );
}
