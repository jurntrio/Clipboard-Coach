import { pageTitle } from "@/lib/page-metadata";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

const roleNames: Record<string, string> = {
  coach: "Trainer", assistant_coach: "Assistent-trainer", team_manager: "Teamafgevaardigde",
  youth_coordinator: "Jeugdcoördinator", head_youth_development: "Hoofd jeugdopleiding",
  technical_director: "Technisch directeur", staff: "Staff"
};

export default async function SharedStaffPage({ params }: { params: { profileId: string } }) {
  const context = await getClubContext();
  if (!context.user) redirect("/login");
  if (!context.activeClubId) notFound();
  const admin = createAdminClient();
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(access, "teams.view")) notFound();

  const [{ data: profile }, { data: trainer }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, phone_number").eq("id", params.profileId).maybeSingle(),
    admin.from("club_trainers").select("id, display_name").eq("club_id", context.activeClubId).eq("profile_id", params.profileId).maybeSingle()
  ]);
  if (!profile || !trainer) notFound();
  const { data: assignments } = await admin.from("club_trainer_teams")
    .select("role, club_team_id, club_teams!inner(id, name, club_id, status)")
    .eq("trainer_id", trainer.id).eq("status", "active").eq("club_teams.club_id", context.activeClubId);
  const sharedTeams = (assignments ?? []).flatMap(assignment => {
    const team = assignment.club_teams as unknown as { id: string; name: string; status: string } | null;
    return team && team.status !== "merged" && canAccessTeam(access, team.id) ? [{ id: team.id, name: team.name, role: assignment.role }] : [];
  });
  if (!sharedTeams.length) notFound();

  const name: string = profile.full_name?.trim() || trainer.display_name?.trim() || "Stafflid";
  return <main className="mx-auto max-w-4xl p-5 sm:p-7">
    <SectionHeader title={name} artworkSrc="/branding/teams.webp" showHome={false} />
    <Link href="/dashboard/teams" className="mb-5 inline-flex text-sm font-semibold text-accent hover:underline">← Terug naar Teams</Link>
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-full bg-avatar text-xl font-bold text-accent">{name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><h2 className="text-xl font-bold text-textBright">{name}</h2><p className="text-sm text-textMuted">Staffprofiel via gedeelde ploegtoegang</p></div></div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase text-textMuted">E-mail</dt><dd className="mt-1 text-textPrimary">{profile.email || "Niet ingevuld"}</dd></div><div><dt className="text-xs font-bold uppercase text-textMuted">Telefoon</dt><dd className="mt-1 text-textPrimary">{profile.phone_number || "Niet ingevuld"}</dd></div></dl>
      <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-textSecondary">Gedeelde ploegen</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{sharedTeams.map(team => <div key={`${team.id}:${team.role}`} className="rounded-lg border border-borderSubtle bg-cardDeep px-4 py-3"><strong className="block text-textBright">{team.name}</strong><span className="text-sm text-textMuted">{roleNames[team.role] ?? team.role}</span></div>)}</div>
    </section>
  </main>;
}

export const generateMetadata = pageTitle("page.staff");
