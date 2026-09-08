"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calculateGame, dateLabel, defaultSettings, euro, type BingoData } from "@/lib/lotto-bingo/game";

const BingoAdmin = dynamic(() => import("./BingoAdmin"), { ssr: false, loading: () => <p className="wrap">Beheer laden…</p> });

export function Balls({ numbers, hits = [], missing = false }: { numbers: number[]; hits?: number[]; missing?: boolean }) {
  return <div className="balls">{numbers.map(n => <span key={n} className={`ball ${hits.includes(n) ? "hit" : missing ? "missing" : ""}`} aria-label={`${n}${hits.includes(n) ? ", reeds getrokken" : missing ? ", nog nodig" : ""}`} title={hits.includes(n) ? "Reeds getrokken" : "Nog nodig"}>{n}</span>)}</div>;
}

export function LottoBingo({ initialData }: { initialData: BingoData | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<BingoData | null>(initialData);
  const [error, setError] = useState(initialData ? "" : "De stand kon niet worden geladen. We proberen opnieuw.");
  const [canManage, setCanManage] = useState(false);
  const [manage, setManage] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await supabase.rpc("lotto_bingo_snapshot");
      if (request !== sequence.current) return;
      if (result.error || !result.data?.settings) throw new Error();
      setData(result.data); setError("");
    } catch { if (request === sequence.current) setError("De actuele stand kon niet worden opgehaald. De laatst geladen stand blijft zichtbaar; we proberen opnieuw."); }
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    let authSequence = 0;
    async function checkAdmin() {
      const request = ++authSequence;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: allowed, error: authError } = user ? await supabase.rpc("lotto_bingo_is_admin") : { data: false, error: null };
        if (!alive || request !== authSequence) return;
        setCanManage(!authError && allowed === true);
        if (authError || allowed !== true) setManage(false);
      } catch { if (alive && request === authSequence) { setCanManage(false); setManage(false); } }
    }
    void checkAdmin();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => { setTimeout(() => { if (alive) void checkAdmin(); }, 0); });
    const onFocus = () => { void refresh(); void checkAdmin(); };
    const timer = setInterval(() => { if (document.visibilityState === "visible") { void refresh(); void checkAdmin(); } }, 15000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    if (!initialData) void refresh();
    return () => { alive = false; subscription.subscription.unsubscribe(); clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [supabase, refresh, initialData]);

  const game = data ? calculateGame(data) : null;
  const settings = data?.settings ?? defaultSettings;
  return <div className="clubboys-bingo">
    <div className="topbar"><div className="topbar-inner"><span className="brand-mini">Supportersclub De Clubboys · K.M. Torhout</span>{canManage && <div className="top-actions"><a className="btn btn-dark" href="/dashboard">SVS</a><button type="button" className="btn btn-gold" aria-expanded={manage} aria-controls="bingo-admin" onClick={() => setManage(!manage)}>{manage ? "Publieke stand" : "Beheer"}</button></div>}</div></div>
    <header className="hero"><div className="hero-inner">
      <div className="logo-wrap">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/clubboys/logo.png" alt="Supportersclub De Clubboys · K.M. Torhout · 1947" width={180} height={180} /></div>
      <div><div className="eyebrow">Supportersclub De Clubboys · Lotto Bingo</div><h1>Wie speelt als eerste zijn 10 nummers weg?</h1><p>De actuele stand wordt automatisch bijgewerkt na elke geldige zaterdagtrekking. Alleen de 6 hoofdnummers tellen mee.</p><div className="hero-meta"><span className="pill">🎟️ {euro(settings.fee)} per deelname</span><span className="pill">🏆 {settings.pot_pct}% naar de winnaarspot</span><span className="pill">📅 Start {dateLabel(settings.start_date)}</span></div></div>
    </div></header>
    <main>
      <section className="public-area wrap" aria-label="Publieke Lotto Bingo-stand">
        {error && <div className="notice error status-message" role="alert">{error} <button className="small-btn" onClick={() => void refresh()}>Opnieuw laden</button></div>}
        {game && data ? <>
          <div className="stats"><div className="stat"><span>Deelnemers</span><strong>{data.participants.length}</strong></div><div className="stat"><span>Prijzenpot</span><strong>{euro(game.pot)}</strong></div><div className="stat"><span>Trekkingen</span><strong>{game.draws.length}</strong></div><div className="stat"><span>Laatste trekking</span><strong style={{ fontSize: 19 }}>{game.lastDraw ? dateLabel(game.lastDraw.draw_date) : "—"}</strong></div></div>
          {game.lastDraw && <div className="card last-draw"><strong>Laatste hoofdnummers · {dateLabel(game.lastDraw.draw_date)}</strong><Balls numbers={game.lastDraw.numbers} hits={game.lastDraw.numbers} /></div>}
          <section className="card"><div className="card-head"><div><h2>Actuele stand</h2><p>Groene nummers zijn al getrokken. Gele nummers moeten nog vallen.</p></div><span className="sub">10 unieke nummers · 1 t.e.m. 45</span></div>
            {!!game.winners.length && <div className="notice winner"><strong>🏆 Winnaar{game.winners.length > 1 ? "s" : ""}: {game.winners.map(p => p.name).join(", ")}</strong><br />{dateLabel(game.winners[0].completedOn!)} · {euro(game.prize)} per winnaar{game.winners.length > 1 && " · De pot wordt gelijk gedeeld."}</div>}
            {game.ranking.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Plaats</th><th scope="col">Deelnemer</th><th scope="col">Gekozen nummers</th><th scope="col">Score</th><th scope="col">Nog nodig</th></tr></thead><tbody>{game.ranking.map((p, index) => <tr key={p.id} className={game.winners.some(w => w.id === p.id) ? "winner-row" : ""}><td><span className={`rank ${index === 0 ? "top" : ""}`}>{index + 1}</span></td><td><div className="name">{p.name}</div>{game.winners.some(w => w.id === p.id) && <div className="sub">🏆 Winnaar</div>}</td><td><Balls numbers={p.numbers} hits={p.hits} /></td><td><span className="score">{p.count}/10</span><div className="progress" aria-hidden="true"><i style={{ width: `${p.count * 10}%` }} /></div></td><td>{p.missing.length ? <Balls numbers={p.missing} missing /> : <strong>Volledig!</strong>}</td></tr>)}</tbody></table></div> : <div className="empty">Er zijn nog geen deelnemers. Binnenkort vind je hier de actuele stand.</div>}
          </section><p className="updated">De stand vernieuwt automatisch. Een getrokken nummer blijft afgevinkt; het bonusnummer telt niet mee.</p>
        </> : <div className="card empty">De Lotto Bingo-stand wordt geladen…</div>}
      </section>
      {canManage && manage && data && <section className="admin wrap" id="bingo-admin"><BingoAdmin data={data} refresh={refresh} /></section>}
    </main>
    <footer className="footer">Supportersclub De Clubboys · K.M. Torhout · 1947<br /><a href="https://sportvisualsystems.com">Powered by Sport Visual Systems</a></footer>
  </div>;
}
