import Link from "next/link";

export type PersonalTrainingRow = {
  id: string;
  title: string;
  ageCategory: string;
  themes: string[];
  publicationState: "personal" | "pending_approval" | "published";
  updatedAt: string;
};

const stateLabel = {
  personal: "Alleen van mij",
  pending_approval: "Wacht op goedkeuring",
  published: "Ook gedeeld met de club"
};

export function PersonalTrainingLibrary({ trainings }: { trainings: PersonalTrainingRow[] }) {
  return <section className="mb-6 overflow-hidden rounded-2xl border border-accent/35 bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accentDim px-5 py-4">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Privé voor jouw account</p><h2 className="mt-1 text-xl font-black text-textBright">Mijn trainingen</h2><p className="mt-1 text-sm text-textMuted">Ook binnen een club blijven deze persoonlijke exemplaren afzonderlijk van de gedeelde clubbibliotheek.</p></div>
      <div className="flex flex-wrap gap-2"><a href="/api/trainings/export" className="rounded-lg border border-accent px-4 py-2 text-sm font-bold text-accent hover:bg-accent hover:text-page">Alles downloaden (.zip)</a><Link href="/dashboard/training/new" className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page">Nieuwe training</Link></div>
    </div>
    {trainings.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{trainings.map(training => <article key={training.id} className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-textBright">{training.title}</h3><p className="mt-1 text-xs text-textMuted">{training.ageCategory}{training.themes.length ? ` · ${training.themes.join(" · ")}` : ""}</p></div><span className="rounded-full bg-card px-2 py-1 text-[10px] font-bold text-textSecondary">{stateLabel[training.publicationState]}</span></div>
      <p className="mt-4 text-xs text-textMuted">Gewijzigd {new Date(training.updatedAt).toLocaleDateString("nl-BE")}</p>
      <Link href={`/dashboard/training/new?personal=${training.id}`} className="mt-3 inline-flex rounded-lg border border-borderButton px-3 py-1.5 text-sm font-bold text-textPrimary hover:border-accent hover:text-accent">Openen en bewerken</Link>
    </article>)}</div> : <div className="p-8 text-center"><p className="font-bold text-textPrimary">Nog geen persoonlijke trainingen</p><p className="mt-1 text-sm text-textMuted">Iedere training die je maakt, verschijnt eerst hier als jouw eigen exemplaar.</p></div>}
  </section>;
}
