"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTagEventKind } from "@/lib/tag-events";

type PublicMatch = { id: string; team_a_name: string; team_b_name: string; match_date: string | null; start_time: string | null; status: string; live_tag_names: string[] };
type PublicPlayer = { id: string; first_name: string; last_name: string; jersey_number: number | null };

export default function LiveTagPage() {
  const { token } = useParams<{ token: string }>();
  const [match, setMatch] = useState<PublicMatch | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [taggerName, setTaggerName] = useState("");
  const [autoName, setAutoName] = useState<string | null>(null);
  const [goalPromptTag, setGoalPromptTag] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    void fetch(`/api/live-tag/${token}`).then(async (response) => {
      if (!response.ok) throw new Error("Deze taglink is niet beschikbaar.");
      return response.json();
    }).then((data) => { setMatch(data.match); setPlayers(data.players); }).catch((error) => setMessage(error.message));
  }, [token]);

  async function detectLoggedInName() {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
    const name = profile?.full_name?.trim() || data.user.email?.split("@")[0] || "";
    if (name) { setAutoName(name); setTaggerName(name); }
    return true;
  }

  useEffect(() => { void detectLoggedInName(); }, []);

  async function handleInlineLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoggingIn(true); setLoginError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoggingIn(false);
    if (error) { setLoginError(error.message); return; }
    setShowLogin(false); setLoginPassword("");
    await detectLoggedInName();
  }

  async function addTag(tagName: string, playerIdsOverride?: string[]) {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/live-tag/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagName, playerIds: playerIdsOverride ?? selectedPlayerIds, taggerName })
    });
    setSaving(false);
    if (!response.ok) { setMessage("De tag kon niet worden opgeslagen."); return; }
    setMessage(`${tagName} opgeslagen om ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
  }

  function handleTagPress(name: string) {
    if (getTagEventKind(name) === "goal") { setGoalPromptTag(name); return; }
    void addTag(name);
  }

  async function confirmGoalScorer(playerId: string | null) {
    const tagName = goalPromptTag;
    setGoalPromptTag(null);
    if (!tagName) return;
    await addTag(tagName, playerId ? [playerId] : []);
  }

  if (!match) return <main className="grid min-h-screen place-items-center bg-page p-6 text-textPrimary">{message || "Wedstrijd laden…"}</main>;
  return (
    <main className="min-h-screen bg-page px-4 py-4 text-textPrimary lg:px-8 lg:py-6">
      <div className="mx-auto max-w-lg lg:max-w-5xl">
        <header className="mb-3 rounded-xl border border-border bg-card p-3 lg:mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Live taggen</p>
          <h1 className="mt-0.5 text-lg font-bold text-textBright lg:text-2xl">{match.team_a_name} – {match.team_b_name}</h1>
          <p className="mt-0.5 text-xs text-textMuted">{match.match_date}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p>
        </header>
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8">
          <section><h2 className="mb-3 text-sm font-semibold text-textBright">Moment toevoegen</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">{match.live_tag_names.map((name) => <button key={name} type="button" disabled={saving} onClick={() => handleTagPress(name)} className="min-h-20 rounded-2xl border border-accent/40 bg-accentDim px-4 py-4 text-lg font-bold text-textBright transition active:scale-95 disabled:opacity-50 lg:min-h-28 lg:text-xl lg:hover:border-accent lg:hover:bg-accentDim/80">{name}</button>)}</div></section>
          <div className="mt-6 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
            {!!players.length && <section className="mb-5 lg:mb-6"><h2 className="mb-2 text-sm font-semibold text-textBright">Speler aanduiden</h2><div className="flex flex-wrap gap-2">{players.map((player) => { const selected = selectedPlayerIds.includes(player.id); return <button key={player.id} type="button" onClick={() => setSelectedPlayerIds((current) => selected ? current.filter((id) => id !== player.id) : [...current, player.id])} className={`rounded-full border px-3 py-2 text-sm ${selected ? "border-accent bg-accentDim text-accent" : "border-borderButton bg-button"}`}>{player.jersey_number ? `${player.jersey_number} · ` : ""}{player.first_name} {player.last_name}</button>; })}</div></section>}
            {!autoName && <label className="block text-sm text-textSecondary">Jouw naam (optioneel)
              <input value={taggerName} onChange={(event) => setTaggerName(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 text-textPrimary" placeholder="Naam tagger" />
            </label>}
            {!autoName && (showLogin ? (
              <form onSubmit={handleInlineLogin} className="mt-3 space-y-2 rounded-xl border border-border bg-cardDeep p-3">
                <input type="email" required autoComplete="email" placeholder="E-mailadres" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <input type="password" required autoComplete="current-password" placeholder="Wachtwoord" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                {loginError && <p className="text-xs text-red-300">{loginError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowLogin(false); setLoginError(""); }} className="flex-1 rounded-lg bg-button px-3 py-2 text-xs text-textPrimary">Annuleren</button>
                  <button type="submit" disabled={loggingIn} className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-page disabled:opacity-50">{loggingIn ? "Bezig…" : "Inloggen"}</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setShowLogin(true)} className="mt-3 text-xs font-semibold text-accent hover:underline">Heb je een account? Inloggen</button>
            ))}
          </div>
        </div>
        {message && <p className="mt-5 rounded-xl border border-border bg-card p-3 text-center text-sm" role="status">{message}</p>}
      </div>
      {goalPromptTag && <GoalScorerPrompt players={players} onSelect={(playerId) => void confirmGoalScorer(playerId)} onCancel={() => setGoalPromptTag(null)} />}
    </main>
  );
}

function GoalScorerPrompt({ players, onSelect, onCancel }: { players: PublicPlayer[]; onSelect: (playerId: string | null) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="goal-scorer-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-borderButton bg-cardAlt p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="goal-scorer-title" className="text-lg font-bold text-textBright">Wie scoorde?</h2>
          <button type="button" onClick={onCancel} aria-label="Sluiten" className="text-2xl text-textMuted hover:text-textPrimary">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {players.map((player) => <button key={player.id} type="button" onClick={() => onSelect(player.id)} className="rounded-xl border border-borderButton bg-button px-3 py-3 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-accentDim">{player.jersey_number ? `${player.jersey_number} · ` : ""}{player.first_name} {player.last_name}</button>)}
          <button type="button" onClick={() => onSelect(null)} className="col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20">&times; Onbekend / niet in lijst</button>
        </div>
      </section>
    </div>
  );
}
