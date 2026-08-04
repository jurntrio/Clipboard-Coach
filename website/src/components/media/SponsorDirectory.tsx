"use client";

import { FormEvent, useEffect, useState } from "react";

type Sponsor = { id: string; company_name: string; logo_url: string | null; website_url: string | null; active: boolean };
type Scope={id:string;name:string;active:boolean}; type Season={id:string;name:string;status:string};

export function SponsorDirectory() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clubId,setClubId]=useState(""); const [scopes,setScopes]=useState<Scope[]>([]); const [seasons,setSeasons]=useState<Season[]>([]); const [seasonId,setSeasonId]=useState(""); const [scopeIds,setScopeIds]=useState<string[]>([]); const [level,setLevel]=useState("sponsor"); const [logo,setLogo]=useState<File|null>(null); const [banner,setBanner]=useState<File|null>(null);

  async function load() {
    const response = await fetch("/api/club/sponsors", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Sponsors konden niet worden geladen.");
    setSponsors(body.sponsors ?? []); setPermissions(body.permissions ?? []); setClubId(body.clubId??"");
    const scopeResponse=await fetch("/api/club/sponsor-scopes",{cache:"no-store"}),scopeBody=await scopeResponse.json(); if(scopeResponse.ok){setScopes(scopeBody.scopes??[]);setSeasons(scopeBody.seasons??[]);setSeasonId(v=>v||scopeBody.seasons?.find((s:Season)=>s.status==="ACTIVE")?.id||"");}
  }
  useEffect(() => { void load().catch(reason => setError(reason.message)); }, []);
  const canManage = permissions.includes("sponsors.manage");

  async function addSponsor(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/club/sponsors", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, websiteUrl, seasonId, scopeIds, sponsorLevel:level }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Sponsor kon niet worden toegevoegd.");
      const logoUrl=logo?await uploadAsset(logo,body.sponsorId,"logo"):null; const bannerUrl=banner?await uploadAsset(banner,body.sponsorId,"banner"):null;
      if(logoUrl||bannerUrl)await fetch(`/api/club/sponsors/${body.sponsorId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({logoUrl,alternateLogoUrl:bannerUrl})});
      setCompanyName(""); setWebsiteUrl(""); setScopeIds([]); setLogo(null); setBanner(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sponsor kon niet worden toegevoegd."); }
    finally { setBusy(false); }
  }
  async function uploadAsset(file:File,sponsorId:string,kind:string){if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>8*1024*1024)throw new Error("Gebruik een PNG, JPEG of WebP van maximaal 8 MB.");const ext=file.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"png",key=`clubs/${clubId}/sponsors/${sponsorId}-${kind}-${crypto.randomUUID()}.${ext}`;const prep=await fetch("/api/videos/upload-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,contentType:file.type})}),p=await prep.json();if(!prep.ok)throw new Error(p.error);const put=await fetch(p.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});if(!put.ok)throw new Error("Upload mislukt.");return p.publicUrl;}
  async function remove(sponsor:Sponsor){if(!confirm(`Sponsor ${sponsor.company_name} verwijderen? Gekoppelde sponsors worden veilig gearchiveerd.`))return;const r=await fetch(`/api/club/sponsors/${sponsor.id}`,{method:"DELETE"}),x=await r.json();if(!r.ok)return setError(x.error);await load();}

  async function toggle(sponsor: Sponsor) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/club/sponsors/${sponsor.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !sponsor.active }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Sponsor kon niet worden aangepast."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sponsor kon niet worden aangepast."); }
    finally { setBusy(false); }
  }

  return <section className="mb-6 rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Sponsors</p><h2 className="mt-1 text-xl font-black text-textBright">Centrale sponsorfiches</h2>
        <p className="mt-1 text-sm text-textMuted">Een bedrijf wordt één keer aangemaakt en kan later meerdere sponsortoewijzingen krijgen.</p></div>
    </div>
    {canManage && <form onSubmit={addSponsor} className="mt-4 grid gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4 md:grid-cols-2">
      <input required value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Bedrijfsnaam" className={inputClass} />
      <input type="url" value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="Website (optioneel)" className={inputClass} />
      <label className="text-xs text-textMuted">Logo · aanbevolen 1000 × 1000 px<input required type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setLogo(e.target.files?.[0]||null)} className="mt-1 block w-full"/></label><label className="text-xs text-textMuted">Banner · aanbevolen 1920 × 640 px<input required type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setBanner(e.target.files?.[0]||null)} className="mt-1 block w-full"/></label>
      <select required value={seasonId} onChange={e=>setSeasonId(e.target.value)} className={inputClass}><option value="">Kies seizoen</option>{seasons.filter(s=>s.status!=="ARCHIVED").map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={level} onChange={e=>setLevel(e.target.value)} className={inputClass}><option value="main_sponsor">Hoofdsponsor</option><option value="partner">Partner</option><option value="sponsor">Sponsor</option><option value="other">Andere</option></select><div className="md:col-span-2 flex flex-wrap gap-3">{scopes.filter(s=>s.active).map(s=><label key={s.id} className="text-sm text-textSecondary"><input type="checkbox" checked={scopeIds.includes(s.id)} onChange={()=>setScopeIds(v=>v.includes(s.id)?v.filter(x=>x!==s.id):[...v,s.id])}/> {s.name}</label>)}</div>
      <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">Sponsor met toewijzing toevoegen</button>
    </form>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">{sponsors.map(sponsor => <article key={sponsor.id} className={`rounded-xl border p-4 ${sponsor.active ? "border-borderSubtle bg-cardDeep" : "border-border bg-cardDeep/50 opacity-70"}`}>
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-textBright">{sponsor.company_name}</h3>
        {sponsor.website_url && <a href={sponsor.website_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-accent">{sponsor.website_url}</a>}</div>
        <span className="rounded-full border border-borderButton px-2 py-1 text-[10px] font-bold uppercase text-textMuted">{sponsor.active ? "Actief" : "Inactief"}</span></div>
      {canManage && <div className="mt-3 flex gap-3"><button type="button" disabled={busy} onClick={() => void toggle(sponsor)} className="text-xs font-semibold text-accent disabled:opacity-50">{sponsor.active ? "Deactiveren" : "Opnieuw activeren"}</button><button type="button" disabled={busy} onClick={()=>void remove(sponsor)} className="text-xs font-semibold text-red-300">Verwijderen</button></div>}
    </article>)}</div>
    {!sponsors.length && !error && <p className="mt-4 text-sm text-textMuted">Nog geen centrale sponsors aangemaakt.</p>}
    {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
  </section>;
}

const inputClass = "rounded-lg border border-borderButton bg-card px-3 py-2 text-sm text-textPrimary outline-none focus:border-accent";
