import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { TrainingAttendanceList } from "@/components/training/TrainingAttendanceList";

export default async function TrainingDetailPage({ params }: { params: { sessionId: string } }) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) redirect("/login");
  const admin = createAdminClient();
  const { data: session } = await admin.from("team_training_sessions")
    .select("id, club_id, club_team_id, training_date, start_time, field_option_id, locker_room_option_id, staff_ids, trainer_info, attendance_confirmed_at, personal_training_id, club_training_id, club_teams(name, teams(id))")
    .eq("id", params.sessionId).eq("club_id", context.activeClubId).maybeSingle();
  if (!session) notFound();
  const access = await getClubAccess(context.activeClubId, context.user);
  const { data: ownTrainer } = await admin.from("club_trainers").select("id")
    .eq("club_id", context.activeClubId).eq("profile_id", context.user.id).maybeSingle();
  const assignedStaff = session.staff_ids.includes(ownTrainer?.id ?? "");
  if (!canAccessTeam(access, session.club_team_id) && !assignedStaff) redirect("/dashboard/training");
  const clubTeam = session.club_teams as unknown as { name: string; teams: { id: string }[] } | null;
  const operationalTeamIds = (clubTeam?.teams ?? []).map(team => team.id);
  const [{ data: players }, { data: options }, { data: staff }, { data: attendance }] = await Promise.all([
    operationalTeamIds.length
      ? admin.from("players").select("id, first_name, last_name").in("team_id", operationalTeamIds).neq("role", "staff").order("last_name").order("first_name")
      : Promise.resolve({ data: [] }),
    admin.from("club_match_options").select("id, option_type, label").eq("club_id", session.club_id).eq("active", true).order("label"),
    session.staff_ids.length
      ? admin.from("club_trainers").select("id, display_name").in("id", session.staff_ids)
      : Promise.resolve({ data: [] }),
    admin.from("team_training_attendance").select("player_id, attendance_status, absence_reason_id, note").eq("training_session_id", session.id)
  ]);
  const field = (options ?? []).find(option => option.id === session.field_option_id)?.label ?? "Nog niet bepaald";
  const lockerRoom = (options ?? []).find(option => option.id === session.locker_room_option_id)?.label ?? "Nog niet bepaald";
  const reasons = (options ?? []).filter(option => option.option_type === "non_selection_reason");
  const editable = !access.readOnly && hasClubPermission(access, "training.manage");

  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard/training" className="text-sm font-semibold text-accent hover:underline">← Alle trainingen</Link>
      {editable && (session.club_training_id
        ? <Link href={`/dashboard/intradesk/${session.club_training_id}`} className="rounded-lg border border-borderButton px-4 py-2 text-sm font-bold text-accent">Open trainingsplan</Link>
        : <Link href={`/dashboard/training/new?sessionId=${session.id}`} className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page">Training opstellen</Link>)}
    </div>
    <header className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">Training</p>
      <h1 className="mt-1 text-2xl font-bold text-textBright">{clubTeam?.name ?? "Teamtraining"}</h1>
      <p className="mt-1 text-textSecondary">{new Date(`${session.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {session.start_time.slice(0, 5)}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Info label="Veld" value={field} /><Info label="Kleedkamer" value={lockerRoom} />
        <Info label="Staff" value={(staff ?? []).map(person => person.display_name).join(", ") || "Nog niemand aangeduid"} />
      </div>
    </header>
    <TrainingAttendanceList sessionId={session.id} players={players ?? []} reasons={reasons} initial={(attendance ?? []) as any} editable={editable}
      confirmedAt={session.attendance_confirmed_at} initialTrainerInfo={session.trainer_info} />
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4"><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{label}</p><p className="mt-1 text-sm font-semibold text-textPrimary">{value}</p></div>;
}
