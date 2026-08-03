import Link from "next/link";

export function TrainingPlanPanel({ sessionId, personalTrainingId, clubTrainingId, availablePlans, editable }: {
  sessionId: string; personalTrainingId: string | null; clubTrainingId: string | null;
  availablePlans: { id: string; title: string }[]; editable: boolean;
}) {
  if (!editable) return null;
  const editHref = personalTrainingId
    ? `/dashboard/training/new?sessionId=${sessionId}&personal=${personalTrainingId}`
    : clubTrainingId ? `/dashboard/training/new?sessionId=${sessionId}&edit=${clubTrainingId}` : null;
  return <section className="rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-textBright">Trainingsvoorbereiding</h2><p className="text-sm text-textMuted">Maak of bewerk de voorbereiding rechtstreeks voor deze geplande training.</p></div>
      {editHref && <Link href={editHref} className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page">Voorbereiding bewerken</Link>}
    </div>
    {!editHref && <div className="mt-4 grid gap-3 md:grid-cols-2"><Link href={`/dashboard/training/new?sessionId=${sessionId}`} className="rounded-xl border border-accent bg-accentDim p-4 font-bold text-accent">Nieuwe voorbereiding maken</Link>
      <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4"><label className="text-sm font-bold text-textPrimary">Training uploaden / uit Intradesk kiezen</label><p className="mt-1 text-xs text-textMuted">Kies een bestaande voorbereiding als basis voor deze training.</p><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{availablePlans.map(plan => <Link key={plan.id} href={`/dashboard/training/new?sessionId=${sessionId}&source=${plan.id}`} className="block rounded-lg px-3 py-2 text-sm text-textSecondary hover:bg-cardHover hover:text-accent">{plan.title}</Link>)}{!availablePlans.length && <p className="text-sm text-textMuted">Nog geen voorbereidingen in Intradesk.</p>}</div></div></div>}
  </section>;
}
