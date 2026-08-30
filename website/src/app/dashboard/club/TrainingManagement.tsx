"use client";

import { useEffect, useMemo, useState } from "react";
import { WorkloadSchemeManager } from "./WorkloadSchemeManager";
import { CentralTrainingScheduler } from "./CentralTrainingScheduler";
import type { ClubMatchOption } from "@/components/clubs/ClubMatchOptionsManager";

type Modality = { id: string; category_id: string; code: string; name: string; description: string; color: string; active: boolean };
type Category = { id: string; system_id: string; code: string; name: string; color: string; display_order: number; active: boolean; club_workload_modalities: Modality[] };
type System = { id: string; name: string; description: string; source: "club" | "import"; active: boolean; club_workload_categories: Category[] };

export function TrainingManagement({ teams, trainers, options, readOnly }: { teams: { id: string; name: string }[]; trainers: { id: string; profile_id: string | null; display_name: string; club_trainer_teams: { club_team_id: string }[] }[]; options: ClubMatchOption[]; readOnly: boolean }) {
  const [tab, setTab] = useState<"planning" | "library" | "schemes">("planning");
  const [systems, setSystems] = useState<System[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newModality, setNewModality] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/club/workload-catalog", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error || "Workloadbibliotheek kon niet geladen worden.");
    setSystems(body.systems ?? []);
    setSelectedSystemId(current => current || body.systems?.[0]?.id || "");
  }
  useEffect(() => { void load(); }, []);
  const system = systems.find(item => item.id === selectedSystemId) ?? null;
  const categories = useMemo(() => [...(system?.club_workload_categories ?? [])].sort((a, b) => a.display_order - b.display_order), [system]);
  useEffect(() => { if (!categories.some(item => item.id === categoryId)) setCategoryId(categories[0]?.id ?? ""); }, [categories, categoryId]);

  async function mutate(payload: Record<string, unknown>, success: string) {
    setBusy(true); setNotice("");
    const response = await fetch("/api/club/workload-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setNotice(body.error || "Bewaren mislukt.");
    setNotice(success); setNewCategory(""); setNewModality(""); await load();
  }

  return <div className="space-y-5">
    <div><h2 className="text-xl font-semibold text-textBright">Trainingen beheren</h2><p className="mt-1 text-sm text-textMuted">Beheer workload, seizoensschema’s en trainingsreeksen centraal voor alle ploegen.</p></div>
    <nav className="flex flex-wrap gap-2 rounded-xl border border-border bg-cardDeep p-2">
      {([['planning','Trainingen plannen'],['library','Workloadbibliotheek'],['schemes','Workloadschema’s']] as const).map(([id,label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab===id?'bg-accent text-page':'text-textPrimary hover:bg-card'}`}>{label}</button>)}
    </nav>
    {notice && <p className="rounded-lg border border-border bg-cardDeep p-3 text-sm text-textSecondary">{notice}</p>}
    {tab === "planning" && <CentralTrainingScheduler teams={teams} trainers={trainers} options={options} readOnly={readOnly} />}
    {tab === "library" && <div className="space-y-4">
      {!systems.length ? <section className="rounded-xl border border-dashed border-border p-5"><h3 className="font-semibold text-textBright">Nog geen workloadsysteem</h3><p className="mt-1 text-sm text-textMuted">Laad de structuur uit de aangeleverde KM Torhout-planning als bewerkbare clubbasis.</p>{!readOnly && <button disabled={busy} onClick={() => void mutate({ action:"initializeTorhout" }, "KM Torhout-basis toegevoegd.")} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-black text-page disabled:opacity-50">KM Torhout-basis laden</button>}</section> : <>
        {!readOnly && <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><h3 className="font-semibold text-textBright">KM Torhout 3 trainingen/week</h3><p className="mt-1 text-sm text-textMuted">Laad of vervolledig de workloadreeks uit de aangeleverde Excel-planning.</p></div><button disabled={busy} onClick={() => void mutate({ action:"initializeTorhout" }, "KM Torhout-schema en bibliotheek zijn beschikbaar.")} className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page disabled:opacity-50">Schema laden</button></section>}
        <label className="block max-w-xl text-sm font-semibold text-textSecondary">Systeem<select value={selectedSystemId} onChange={event => setSelectedSystemId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary">{systems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="grid gap-4 lg:grid-cols-2">{categories.map(category => <section key={category.id} className="rounded-xl border border-border bg-card p-4" style={{ borderLeftColor: category.color, borderLeftWidth: 5 }}><h3 className="font-bold text-textBright">{category.name}</h3><div className="mt-3 flex flex-wrap gap-2">{[...(category.club_workload_modalities ?? [])].sort((a,b)=>a.name.localeCompare(b.name)).map(item => <span key={item.id} className="rounded-full border border-borderButton bg-button px-3 py-1 text-sm text-textPrimary">{item.name}</span>)}</div>{!readOnly && <div className="mt-4 flex gap-2"><input value={categoryId===category.id?newModality:""} onFocus={()=>setCategoryId(category.id)} onChange={event=>{setCategoryId(category.id);setNewModality(event.target.value);}} placeholder={`Nieuwe mogelijkheid bij ${category.name}`} className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"/><button disabled={busy||categoryId!==category.id||!newModality.trim()} onClick={()=>void mutate({action:"addModality",categoryId:category.id,name:newModality,color:category.color},`${newModality} toegevoegd aan ${category.name}.`)} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page disabled:opacity-40">Toevoegen</button></div>}</section>)}</div>
        {!readOnly && <section className="rounded-xl border border-dashed border-border p-4"><h3 className="font-semibold text-textBright">Eigen categorie toevoegen</h3><div className="mt-3 flex max-w-xl gap-2"><input value={newCategory} onChange={event=>setNewCategory(event.target.value)} placeholder="Bijvoorbeeld Mobiliteit" className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"/><button disabled={busy||!newCategory.trim()} onClick={()=>void mutate({action:"addCategory",systemId:selectedSystemId,name:newCategory},`${newCategory} toegevoegd.`)} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page disabled:opacity-40">Categorie toevoegen</button></div></section>}
      </>}
    </div>}
    {tab === "schemes" && <WorkloadSchemeManager systems={systems} readOnly={readOnly} />}
  </div>;
}
