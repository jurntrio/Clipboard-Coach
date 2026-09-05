"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { dateLabel, parseNumbers, validSaturday, type BingoData, type Participant, type Draw } from "@/lib/lotto-bingo/game";
import { Balls } from "./LottoBingo";
import { generateStandImages, type StandImage } from "@/lib/lotto-bingo/export";

function databaseMessage(error: { code?: string; message?: string }) {
  if (error.code === "42501" || error.code === "PGRST301") return "Je hebt geen beheerrechten (meer). Meld je aan via SVS als General Admin.";
  if (error.code === "23505") return "Voor deze zaterdag bestaat al een trekking.";
  if (error.code === "23514") return "Controleer de nummers, datum en instellingen. De startdatum mag niet na een bestaande trekking liggen.";
  return "Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.";
}

export default function BingoAdmin({ data, refresh }: { data: BingoData; refresh: () => Promise<void> }) {
  const supabase = useMemo(() => createClient(), []);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [draw, setDraw] = useState<Draw | null>(null);
  const [name, setName] = useState("");
  const [numbers, setNumbers] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [drawNumbers, setDrawNumbers] = useState("");
  const [tab, setTab] = useState("participants");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [images, setImages] = useState<StandImage[]>([]);
  useEffect(() => () => { images.forEach(image => URL.revokeObjectURL(image.url)); }, [images]);

  async function perform(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setMessage(""); setError(false);
    try {
      const { data: allowed, error: authError } = await supabase.rpc("lotto_bingo_is_admin");
      if (authError || allowed !== true) throw new Error("Alleen General Admin mag Lotto Bingo beheren. Meld je aan via SVS.");
      await action(); await refresh(); setImages([]); setMessage(success);
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Er ging iets mis. Probeer opnieuw."); }
    finally { setBusy(false); }
  }
  function checkResult(result: { error: { code?: string; message?: string } | null; data: unknown[] | null }) {
    if (result.error) throw new Error(databaseMessage(result.error));
    if (!result.data?.length) throw new Error("Niet opgeslagen: de gegevens of je rechten zijn gewijzigd. Vernieuw de pagina en probeer opnieuw.");
  }
  function resetParticipant() { setParticipant(null); setName(""); setNumbers(""); }
  function resetDraw() { setDraw(null); setDrawDate(""); setDrawNumbers(""); }
  function editParticipant(p: Participant) { setParticipant(p); setName(p.name); setNumbers(p.numbers.join(", ")); document.getElementById("bingo-participant-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function editDraw(d: Draw) { setDraw(d); setDrawDate(d.draw_date); setDrawNumbers(d.numbers.join(", ")); document.getElementById("bingo-draw-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  function saveParticipant(event: FormEvent) {
    event.preventDefault();
    if (participant && !window.confirm("Deze deelnemer aanpassen? Het klassement en eventuele winnaars worden opnieuw berekend.")) return;
    void perform(async () => {
      const value = { name: name.trim(), numbers: parseNumbers(numbers, 10) };
      if (!value.name || value.name.length > 100) throw new Error("Vul een naam van 1 tot 100 tekens in.");
      const table = supabase.from("lotto_bingo_participants");
      checkResult(await (participant ? table.update(value).eq("id", participant.id).eq("name", participant.name).eq("numbers", `{${participant.numbers.join(",")}}`) : table.insert(value)).select("id"));
      resetParticipant();
    }, "Deelnemer opgeslagen. De stand is bijgewerkt.");
  }
  function saveDraw(event: FormEvent) {
    event.preventDefault();
    if (draw && !window.confirm("Deze trekking aanpassen? Het klassement en eventuele winnaars worden opnieuw berekend.")) return;
    void perform(async () => {
      if (!validSaturday(drawDate) || drawDate < data.settings.start_date) throw new Error("Kies een zaterdag op of na de startdatum.");
      const value = { draw_date: drawDate, numbers: parseNumbers(drawNumbers, 6) };
      const table = supabase.from("lotto_bingo_draws");
      checkResult(await (draw ? table.update(value).eq("id", draw.id).eq("draw_date", draw.draw_date).eq("numbers", `{${draw.numbers.join(",")}}`) : table.insert(value)).select("id"));
      resetDraw();
    }, "Trekking opgeslagen. De stand is bijgewerkt.");
  }
  function remove(kind: "participants" | "draws", record: Participant | Draw) {
    if (!window.confirm(`${kind === "participants" ? "Deze deelnemer" : "Deze trekking"} verwijderen? Het klassement en eventuele winnaars worden opnieuw berekend.`)) return;
    void perform(async () => {
      let query = supabase.from(`lotto_bingo_${kind}`).delete().eq("id", record.id).eq("numbers", `{${record.numbers.join(",")}}`);
      query = "name" in record ? query.eq("name", record.name) : query.eq("draw_date", record.draw_date);
      checkResult(await query.select("id"));
      if (participant?.id === record.id) resetParticipant();
      if (draw?.id === record.id) resetDraw();
    }, "Verwijderd. De stand is opnieuw berekend.");
  }
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm("Instellingen aanpassen? De prijzenpot en spelinformatie veranderen voor iedereen.")) return;
    void perform(async () => {
      const value = { fee: Number(form.get("fee")), pot_pct: Number(form.get("pot_pct")), start_date: String(form.get("start_date")) };
      if (!Number.isFinite(value.fee) || value.fee < 0 || value.fee > 10000 || !Number.isFinite(value.pot_pct) || value.pot_pct < 0 || value.pot_pct > 100 || !validSaturday(value.start_date)) throw new Error("Gebruik een geldig bedrag, een percentage van 0 tot 100 en een zaterdag als startdatum.");
      checkResult(await supabase.from("lotto_bingo_settings").update(value).eq("id", 1).eq("fee", data.settings.fee).eq("pot_pct", data.settings.pot_pct).eq("start_date", data.settings.start_date).select("id"));
    }, "Instellingen opgeslagen.");
  }
  async function exportImages(format: "png" | "jpeg") {
    if (busy) return;
    setBusy(true); setMessage(""); setError(false);
    try {
      const { data: allowed } = await supabase.rpc("lotto_bingo_is_admin");
      if (allowed !== true) throw new Error("Alleen General Admin kan de deelafbeeldingen genereren.");
      const result = await supabase.rpc("lotto_bingo_snapshot");
      if (result.error || !result.data?.settings) throw new Error("De actuele stand kon niet worden opgehaald. Probeer opnieuw.");
      setImages(await generateStandImages(result.data, format));
      setMessage("Je afbeeldingen zijn klaar. Download de pagina’s hieronder en plaats ze op Facebook.");
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "De afbeelding kon niet worden gemaakt."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="admin-banner"><div><h2>Beheer Lotto Bingo</h2><p>General Admin · wijzigingen zijn zichtbaar voor iedereen.</p></div><div className="actions"><button className="btn btn-light" disabled={busy} onClick={() => void exportImages("png")}>📸 Stand als PNG</button><button className="btn btn-light" disabled={busy} onClick={() => void exportImages("jpeg")}>📸 Stand als JPEG</button></div></div>
    {message && <div role={error ? "alert" : "status"} className={`notice status-message ${error ? "error" : ""}`}>{message}</div>}
    {!!images.length && <section className="card form-card"><h3>Download voor Facebook</h3><p>Alle deelnemers staan erop, verdeeld over {images.length} pagina{images.length === 1 ? "" : "’s"}.</p><div className="export-previews">{images.map((image, index) => <div key={image.url}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={`Voorbeeld klassement, pagina ${index + 1}`} /><a className="btn btn-green" href={image.url} download={image.filename}>Download pagina {index + 1}</a></div>)}</div></section>}
    <div className="grid" style={{ marginTop: 16 }}>
      <form className="card form-card" id="bingo-participant-form" onSubmit={saveParticipant}><h3>{participant ? "Deelnemer aanpassen" : "Deelnemer toevoegen"}</h3><label htmlFor="bingo-name">Naam</label><input id="bingo-name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} disabled={busy} placeholder="bv. Jan Peeters" /><label htmlFor="bingo-numbers">10 verschillende nummers</label><input id="bingo-numbers" value={numbers} onChange={e => setNumbers(e.target.value)} required disabled={busy} placeholder="3, 7, 12, 18, 21, 27, 31, 35, 40, 46" /><p className="help">Exact 10 unieke gehele nummers van 1 t.e.m. 46. Scheid ze met komma’s of spaties.</p><div className="form-actions"><button className="btn btn-green" disabled={busy}>{participant ? "Wijzigingen opslaan" : "Deelnemer toevoegen"}</button>{participant && <button type="button" className="btn btn-light" disabled={busy} onClick={resetParticipant}>Annuleren</button>}</div></form>
      <form className="card form-card" id="bingo-draw-form" onSubmit={saveDraw}><h3>{draw ? "Trekking aanpassen" : "Lotto-trekking toevoegen"}</h3><label htmlFor="bingo-date">Datum</label><input id="bingo-date" type="date" min={data.settings.start_date} value={drawDate} onChange={e => setDrawDate(e.target.value)} required disabled={busy} /><label htmlFor="bingo-draw-numbers">6 hoofdnummers</label><input id="bingo-draw-numbers" value={drawNumbers} onChange={e => setDrawNumbers(e.target.value)} required disabled={busy} placeholder="4, 9, 16, 22, 34, 41" /><p className="help">Alleen zaterdag, vanaf {dateLabel(data.settings.start_date)}. Het reserve- of bonusnummer telt niet mee.</p><div className="form-actions"><button className="btn btn-green" disabled={busy}>{draw ? "Wijzigingen opslaan" : "Trekking toevoegen"}</button>{draw && <button type="button" className="btn btn-light" disabled={busy} onClick={resetDraw}>Annuleren</button>}</div></form>
    </div>
    <div className="admin-tabs" role="group" aria-label="Beheergedeelte">{[["participants", "Deelnemers"], ["draws", "Trekkingen"], ["settings", "Instellingen"]].map(([key, label]) => <button key={key} type="button" className={`btn ${tab === key ? "btn-green" : "btn-light"}`} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "participants" && <section className="card"><div className="card-head"><h2>Deelnemers beheren</h2></div>{data.participants.length ? <div className="table-wrap"><table><thead><tr><th>Naam</th><th>Nummers</th><th>Acties</th></tr></thead><tbody>{data.participants.map(p => <tr key={p.id}><td className="name">{p.name}</td><td><Balls numbers={p.numbers} /></td><td><div className="actions"><button className="small-btn" disabled={busy} onClick={() => editParticipant(p)}>Aanpassen</button><button className="small-btn danger" disabled={busy} onClick={() => remove("participants", p)}>Verwijderen</button></div></td></tr>)}</tbody></table></div> : <p className="empty">Nog geen deelnemers.</p>}</section>}
    {tab === "draws" && <section className="card"><div className="card-head"><h2>Trekkingen beheren</h2></div>{data.draws.length ? <div className="table-wrap"><table><thead><tr><th>Datum</th><th>Hoofdnummers</th><th>Acties</th></tr></thead><tbody>{[...data.draws].reverse().map(d => <tr key={d.id}><td>{dateLabel(d.draw_date)}</td><td><Balls numbers={d.numbers} /></td><td><div className="actions"><button className="small-btn" disabled={busy} onClick={() => editDraw(d)}>Aanpassen</button><button className="small-btn danger" disabled={busy} onClick={() => remove("draws", d)}>Verwijderen</button></div></td></tr>)}</tbody></table></div> : <p className="empty">Nog geen trekkingen.</p>}</section>}
    {tab === "settings" && <form className="card form-card" onSubmit={saveSettings}><h3>Spelinstellingen</h3><div className="grid"><div><label htmlFor="bingo-fee">Bedrag per deelname (€)</label><input id="bingo-fee" name="fee" type="number" min="0" max="10000" step="0.01" defaultValue={data.settings.fee} required disabled={busy} /></div><div><label htmlFor="bingo-pot">Percentage voor de prijzenpot</label><input id="bingo-pot" name="pot_pct" type="number" min="0" max="100" step="0.01" defaultValue={data.settings.pot_pct} required disabled={busy} /></div><div><label htmlFor="bingo-start">Startdatum (zaterdag)</label><input id="bingo-start" name="start_date" type="date" defaultValue={data.settings.start_date} required disabled={busy} /></div></div><p className="settings-note">De prijzenpot wordt berekend op basis van alle deelnemers. Betalingen houd je zelf bij; deze pagina registreert geen betalingen.</p><div className="form-actions"><button className="btn btn-green" disabled={busy}>Instellingen opslaan</button></div></form>}
  </>;
}
