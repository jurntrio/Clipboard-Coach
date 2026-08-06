import type { TrainingWeekGroup } from "@/components/training/TrainingOverview";
import { TrainingRow } from "@/components/training/TrainingRow";

export function TrainingWeek({ week, optionNames, canManage, past }: { week: TrainingWeekGroup; optionNames: Record<string, string>; canManage: boolean; past: boolean }) {
  const format = (date: string, year = false) => new Date(`${date}T12:00:00`).toLocaleDateString("nl-BE", { day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}) });
  return <section className="overflow-hidden rounded-xl border border-border bg-card"><header className="border-b border-borderSubtle bg-cardDeep px-4 py-2"><h3 className="text-xs font-bold uppercase tracking-wide text-textSecondary">{format(week.monday)} – {format(week.sunday, true)}</h3></header><div className="divide-y divide-borderSubtle">{week.sessions.map(session => <TrainingRow key={session.id} session={session} optionNames={optionNames} canManage={canManage} past={past} />)}</div></section>;
}
