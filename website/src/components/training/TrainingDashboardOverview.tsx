import Link from "next/link";
import type { TrainingSessionSummary } from "@/components/training/types";

export function TrainingDashboardOverview({ sessions, optionNames, canManage }: { sessions: TrainingSessionSummary[]; optionNames: Record<string, string>; canManage: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions.filter(session => session.training_date >= today).slice(0, 6);
  const withoutPlan = sessions.filter(session => session.training_date >= today && !session.personal_training_id && !session.club_training_id).length;
  const unread = sessions.reduce((total, session) => total + session.new_contact_updates, 0);
  const unconfirmedPast = sessions.filter(session => session.training_date < today && !session.attendance_confirmed_at).length;
  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-3"><Fact label="Zonder voorbereiding" value={withoutPlan} /><Fact label="Nieuwe beschikbaarheden" value={unread} /><Fact label="Nog te bevestigen" value={unconfirmedPast} /></section>
    <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-textBright">Eerstvolgende trainingen</h2><Link href="/dashboard/training?view=planning" className="text-sm font-bold text-accent hover:underline">Volledige planning</Link></div>
      <div className="mt-4 divide-y divide-borderSubtle">{upcoming.map(session => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><Link href={`/dashboard/training/${session.id}`} className="font-semibold text-textBright hover:text-accent">{new Date(`${session.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })} · {session.start_time.slice(0, 5)} <span className="ml-2 text-sm font-normal text-textMuted">{session.club_teams?.name}</span> <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">Fase: {session.season_phase}</span></Link><p className="text-sm text-textSecondary">{optionNames[session.field_option_id ?? ""] ?? "Veld –"} · {session.attendance_absent} afwezig</p>{canManage && <Link href={`/dashboard/training/new?sessionId=${session.id}${session.personal_training_id ? `&personal=${session.personal_training_id}` : ""}`} className="rounded-lg border border-borderButton px-3 py-1.5 text-sm font-bold text-accent">{session.personal_training_id || session.club_training_id ? "Voorbereiding" : "Voorbereiding maken"}</Link>}</div>)}</div>
      {!upcoming.length && <p className="mt-4 text-sm text-textMuted">Geen komende trainingen.</p>}
    </section>
  </div>;
}

function Fact({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{label}</p><p className="mt-1 text-2xl font-black text-textBright">{value}</p></div>; }
