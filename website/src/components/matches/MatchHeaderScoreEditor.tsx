"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MatchHeaderScoreEditor({ matchId, homeTeamName, awayTeamName, homeScore, awayScore }: {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
}) {
  const router = useRouter();
  const [home, setHome] = useState(homeScore?.toString() ?? "");
  const [away, setAway] = useState(awayScore?.toString() ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNotice("Bewaren…");
    const response = await fetch(`/api/matches/${matchId}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreHome: home, scoreAway: away })
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setNotice(body?.error || "De score kon niet worden bewaard.");
    setNotice("Bewaard");
    router.refresh();
  }

  return <div className="min-w-28">
    <div className="flex items-center justify-center gap-2">
      <label className="sr-only" htmlFor="score-home">Score {homeTeamName}</label>
      <input id="score-home" type="number" min="0" max="30" value={home} onChange={event => setHome(event.target.value)} className="w-14 rounded-xl border border-border bg-input px-2 py-2 text-center text-2xl font-black text-textBright" />
      <span className="text-xl font-black text-textBright">–</span>
      <label className="sr-only" htmlFor="score-away">Score {awayTeamName}</label>
      <input id="score-away" type="number" min="0" max="30" value={away} onChange={event => setAway(event.target.value)} className="w-14 rounded-xl border border-border bg-input px-2 py-2 text-center text-2xl font-black text-textBright" />
    </div>
    <button type="button" disabled={busy} onClick={() => void save()} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-page disabled:opacity-50">Score bewaren</button>
    {notice && <span className="mt-1 block text-center text-xs text-textMuted">{notice}</span>}
  </div>;
}
