import Link from "next/link";
import { MenuIcon } from "@/components/ui/MenuIcon";
import type { TrainingSessionSummary } from "@/components/training/types";

export function TrainingRow({ session, optionNames, canManage }: { session: TrainingSessionSummary; optionNames: Record<string, string>; canManage: boolean }) {
  const hasPlan = !!(session.personal_training_id || session.club_training_id);
  return <div className="grid items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(270px,1.2fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(120px,auto)_auto]">
    <Link href={`/dashboard/training/${session.id}`} className="font-semibold text-textBright hover:text-accent">{new Date(`${session.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })} · {session.start_time.slice(0, 5)}<span className="ml-2 text-xs font-normal text-textMuted">{session.player_groups ? `${session.player_groups.icon ?? "＋"} Extra groep · ${session.player_groups.name}` : session.club_teams?.name}</span></Link>
    <p className="truncate text-sm text-textPrimary"><span className="mr-2 text-xs font-bold uppercase text-textMuted">Veld</span>{optionNames[session.field_option_id ?? ""] ?? "–"}</p>
    <p className="truncate text-sm text-textPrimary"><span className="mr-2 text-xs font-bold uppercase text-textMuted">KK</span>{optionNames[session.locker_room_option_id ?? ""] ?? "–"}</p>
    <p className="text-sm text-textSecondary">{Math.max(0, session.roster_total - session.attendance_absent)}/{session.roster_total}{session.new_contact_updates > 0 && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-page">{session.new_contact_updates} nieuw</span>}</p>
    {canManage && <Link href={`/dashboard/training/${session.id}`} title={hasPlan ? "Training en voorbereiding openen" : "Training openen"} aria-label={hasPlan ? "Training en voorbereiding openen" : "Training openen"} className="justify-self-end rounded-xl border border-borderButton bg-button p-1.5 hover:border-accent"><MenuIcon src="/branding/Menu/edit.svg" compact /></Link>}
  </div>;
}
