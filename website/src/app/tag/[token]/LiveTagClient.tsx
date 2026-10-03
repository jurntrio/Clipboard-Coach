"use client";

import { useEffect, useRef, useState } from "react";

import { PasswordInput } from "@/components/auth/PasswordInput";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import { getMatchDisplay } from "@/lib/match-display";

type PublicMatch = { id: string; team_a_name: string; team_b_name: string; is_home_match: boolean; match_date: string | null; start_time: string | null; status: string; score_a: number | null; score_b: number | null; live_tag_names: string[]; official_home_team_name?: string | null; official_away_team_name?: string | null };

export default function LiveTagPage({ token, initialMatch }: { token: string; initialMatch: PublicMatch | null }) {
  const match = initialMatch;
  const [taggerName, setTaggerName] = useState("");
  const [autoName, setAutoName] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const savingRef = useRef(false);
  const pendingEventRef = useRef<{ signature: string; id: string } | null>(null);
  const screenActive = useScreenWakeLock(!!match);
  async function detectLoggedInName() {
    const { createClient } = await import("@/lib/supabase/client");
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
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoggingIn(false);
    if (error) { setLoginError(error.message); return; }
    setShowLogin(false); setLoginPassword("");
    await detectLoggedInName();
  }

  async function addTag(tagName: string) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setMessage("");
    const selectedIds: string[] = [];
    const signature = `${tagName.trim().toLocaleLowerCase()}::${[...selectedIds].sort().join(",")}`;
    const clientEventId = pendingEventRef.current?.signature === signature
      ? pendingEventRef.current.id
      : crypto.randomUUID();
    pendingEventRef.current = { signature, id: clientEventId };
    try {
      const response = await fetch(`/api/live-tag/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName,
          playerIds: selectedIds,
          taggerName,
          clientEventId
        })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setMessage(result?.error || "De tag kon niet worden opgeslagen.");
        return;
      }
      pendingEventRef.current = null;
      setMessage(`${tagName} opgeslagen om ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
    } catch {
      setMessage("De verbinding viel weg. Tik opnieuw om hetzelfde moment veilig opnieuw te verzenden.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!match) return <main className="grid min-h-screen place-items-center bg-page p-6 text-textPrimary">{message || "Wedstrijd laden…"}</main>;
  const { homeTeamName, awayTeamName } = getMatchDisplay(match);
  return (
    <main className="min-h-screen bg-page px-4 py-4 text-textPrimary lg:px-8 lg:py-6">
      <div className="mx-auto max-w-lg lg:max-w-5xl">
        <header className="mb-3 rounded-xl border border-border bg-card p-3 lg:mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Live taggen</p>
          <h1 className="mt-0.5 text-lg font-bold text-textBright lg:text-2xl">{homeTeamName} – {awayTeamName}</h1>
          <p className="mt-0.5 text-xs text-textMuted">{match.match_date}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p>
          <p className="mt-1 text-xs text-textMuted">{screenActive ? "Scherm blijft actief tijdens het taggen." : "Scherm actief houden is niet beschikbaar. Controleer je scherminstellingen of open deze link in Safari/Chrome."}</p>
        </header>
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8">
          <section><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">{match.live_tag_names.map((name) => <button key={name} type="button" disabled={saving} onClick={() => void addTag(name)} className="min-h-20 rounded-2xl border border-accent/40 bg-accentDim px-4 py-4 text-lg font-bold text-textBright transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-28 lg:text-xl lg:hover:border-accent lg:hover:bg-accentDim/80">{name}</button>)}</div></section>
          <div className="mt-6 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
            {!autoName && <label className="block text-sm text-textSecondary">Jouw naam (optioneel)
              <input value={taggerName} onChange={(event) => setTaggerName(event.target.value)} className="mt-1 w-full rounded-xl border border-border bg-input px-4 py-3 text-textPrimary" placeholder="Naam tagger" />
            </label>}
            {!autoName && (showLogin ? (
              <form onSubmit={handleInlineLogin} className="mt-3 space-y-2 rounded-xl border border-border bg-cardDeep p-3">
                <input type="email" required autoComplete="email" placeholder="E-mailadres" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <PasswordInput required autoComplete="current-password" placeholder="Wachtwoord" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                {loginError && <p className="text-xs text-red-300">{loginError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowLogin(false); setLoginError(""); }} className="flex-1 rounded-lg bg-button px-3 py-2 text-xs text-textPrimary">Annuleren</button>
                  <button type="submit" disabled={loggingIn} className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{loggingIn ? "Bezig…" : "Inloggen"}</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setShowLogin(true)} className="mt-3 text-xs font-semibold text-accent hover:underline">Heb je een account? Inloggen</button>
            ))}
          </div>
        </div>
        {message && <p className="mt-5 rounded-xl border border-border bg-card p-3 text-center text-sm" role="status">{message}</p>}
      </div>
    </main>
  );
}
