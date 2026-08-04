import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { getCoachOverviews, isBanned } from "./data";
import { PlanBadge } from "./PlanBadge";
import { getServerI18n } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminClubModuleToggles } from "./AdminClubModuleToggles";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { PlatformInvitationCreator } from "./PlatformInvitationCreator";
import { requireAdminOrViewer } from "@/lib/auth/admin";

export default async function AdminOverviewPage() {
  const { isFullAdmin } = await requireAdminOrViewer();
  const admin = createAdminClient();
  const [coaches, { data: clubs }] = await Promise.all([
    getCoachOverviews(),
    admin
      .from("clubs")
      .select("id, name, rbfa_registration_number, club_teams:club_teams!club_teams_club_id_fkey(id, name, teams(id, players(id, first_name, last_name, role))), club_memberships(profile_id, role), club_module_entitlements(module_key, enabled), club_trainers(id, profile_id, display_name, phone_number, invitation_status, profiles(email), club_trainer_teams(club_teams(name)))")
      .order("name")
  ]);
  const { locale, t } = getServerI18n();
  const coachesWithoutTeams = coaches.filter((coach) =>
    coach.teamCount === 0
    && !["platform_admin", "admin_viewer", "club_admin", "club_admin_viewer", "analyst"].includes(coach.account_role)
    && (coach.membershipRoles.length === 0 || coach.membershipRoles.includes("trainer"))
  );
  const coachesById = new Map(coaches.map((coach) => [coach.id, coach]));

  const totals = coaches.reduce(
    (acc, c) => ({
      videos: acc.videos + c.videoCount,
      failed: acc.failed + c.failedVideoCount,
      clips: acc.clips + c.clipCount,
      storage: acc.storage + c.storageBytes
    }),
    { videos: 0, failed: 0, clips: 0, storage: 0 }
  );
  const distinctTeamCount = new Set(coaches.flatMap((c) => c.teamNames)).size;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SectionHeader title={t("common.admin")} subtitle={t("admin.subtitle")} artworkSrc="/branding/admin.png" />

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-8">
        <StatTile label={t("admin.coaches")} value={coaches.length} />
        <StatTile label="Clubs" value={clubs?.length ?? 0} />
        <StatTile label={t("common.teams")} value={distinctTeamCount} />
        <StatTile label={t("admin.videos")} value={totals.videos} />
        <StatTile label={t("admin.failed")} value={totals.failed} warn={totals.failed > 0} />
        <StatTile label={t("common.clips")} value={totals.clips} />
        <StatTile label={t("admin.storage")} value={formatBytes(totals.storage)} />
      </div>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-textBright">{t("admin.clubManagement")}</h2>
            <p className="mt-1 text-sm text-textMuted">
              {t("admin.clubManagementSubtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/admin/club-matching"
              className="rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent hover:text-accent"
            >
              Clubnaam-matching
            </Link>
            <Link
              href="/dashboard/admin/belgian-clubs"
              className="rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent hover:text-accent"
            >
              Belgische clublogo&apos;s
            </Link>
            <Link
              href="/dashboard/admin/clubs"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:brightness-110"
            >
              {t("admin.viewClubs")}
            </Link>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(clubs ?? []).map((club) => {
            const memberships = (club.club_memberships ?? []) as { role: string }[];
            const clubAdminCount = memberships.filter((membership) => membership.role === "club_admin").length;
            const trainers = (club.club_trainers ?? []) as unknown as {
              id: string;
              profile_id: string | null;
              display_name: string;
              phone_number: string | null;
              invitation_status: string;
              profiles: { email: string } | { email: string }[] | null;
              club_trainer_teams: { club_teams: { name: string } | { name: string }[] | null }[];
            }[];
            const invitationTeams = (club.club_teams ?? []).map((team) => ({
              id: team.id,
              name: team.name,
              players: (team.teams ?? []).flatMap((operationalTeam) => operationalTeam.players ?? [])
                .filter((player) => player.role === "player")
                .map((player) => ({ id: player.id, name: `${player.first_name} ${player.last_name}`.trim() }))
            }));
            return (
              <details key={club.id} className="group rounded-lg border border-borderSubtle bg-cardDeep">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="font-medium text-textPrimary">{club.name}</div>
                    <div className="mt-1 text-xs text-textMuted">
                      {club.rbfa_registration_number ? `RBFA ${club.rbfa_registration_number}` : t("admin.noRegistrationNumber")}
                      {" · "}
                      {trainers.length === 1 ? t("admin.trainerCount", { count: trainers.length }) : t("admin.trainerCountPlural", { count: trainers.length })}
                      {" · "}
                      {clubAdminCount === 1 ? t("admin.clubAdminCount", { count: clubAdminCount }) : t("admin.clubAdminCountPlural", { count: clubAdminCount })}
                    </div>
                  </div>
                  <span className="text-accent transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                </summary>
                <AdminClubModuleToggles
                  clubId={club.id}
                  clubName={club.name}
                  teams={invitationTeams}
                  entitlements={(club.club_module_entitlements ?? []) as { module_key: string; enabled: boolean }[]}
                />
                <div className="border-t border-borderSubtle px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-textPrimary">Ploegen</h3>
                    <span className="text-xs text-textMuted">{club.club_teams?.length ?? 0}</span>
                  </div>
                  {(club.club_teams?.length ?? 0) > 0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(club.club_teams ?? []).map((team) => (
                        <div key={team.id} className="rounded-lg border border-borderSubtle bg-card px-3 py-2 text-sm text-textSecondary">
                          {team.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-textMuted">Nog geen ploegen toegevoegd.</p>
                  )}
                </div>
                <div className="overflow-x-auto border-t border-borderSubtle">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="text-xs uppercase text-textMuted">
                      <tr><th className="px-4 py-2 text-left">{t("admin.colName")}</th><th className="px-4 py-2 text-left">Functie</th><th className="px-4 py-2 text-left">{t("admin.colTeams")}</th><th className="px-4 py-2 text-left">{t("admin.colPhone")}</th><th className="px-4 py-2 text-left">{t("admin.colEmail")}</th><th className="px-4 py-2 text-left">Laatste login</th></tr>
                    </thead>
                    <tbody>
                      {trainers.map((trainer) => (
                        <tr key={trainer.id} className="border-t border-borderSubtle">
                          <td className="px-4 py-2 text-textPrimary">{trainer.display_name}{trainer.invitation_status !== "linked" && <span className="ml-2 text-xs text-amber-300">{t("admin.notLinkedYet")}</span>}</td>
                          <td className="px-4 py-2 text-textSecondary">{trainer.profile_id ? formatFunctions(coachesById.get(trainer.profile_id)?.functionRoles) : "—"}</td>
                          <td className="px-4 py-2 text-textSecondary">{trainer.club_trainer_teams.map((link) => relationValue(link.club_teams)?.name).filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-4 py-2 text-textSecondary">{trainer.phone_number || "—"}</td>
                          <td className="px-4 py-2 text-textSecondary">{relationValue(trainer.profiles)?.email || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2 text-textSecondary">{trainer.profile_id ? formatLastLogin(coachesById.get(trainer.profile_id)?.last_sign_in_at, locale) : "—"}</td>
                        </tr>
                      ))}
                      {!trainers.length && <tr><td colSpan={6} className="px-4 py-4 text-center text-textMuted">{t("admin.noneTrainersAssigned")}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
          {!clubs?.length && (
            <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-textMuted">
              {t("admin.noneClubs")}
            </div>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-textBright">Gebruikers zonder toegewezen ploeg</h2>
            <p className="mt-1 text-sm text-textMuted">{t("admin.usersWithoutTeamSubtitle")}</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">{coachesWithoutTeams.length}</span>
        </div>
        <div className="mt-4 divide-y divide-borderSubtle rounded-lg border border-borderSubtle bg-cardDeep">
          {coachesWithoutTeams.map((coach) => (
            <div key={coach.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium text-textPrimary">{coach.full_name || coach.email}</div>
                <div className="text-xs text-textMuted">{coach.email}</div>
                <div className="mt-1 text-xs text-textSecondary">
                  Club: {coach.clubNames.join(", ") || "geen club"} · Functie: {formatFunctions(coach.functionRoles)}
                </div>
              </div>
              <Link href={`/dashboard/admin/coaches/${coach.id}`} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary hover:border-accent hover:text-accent">{t("admin.assignTeam")}</Link>
            </div>
          ))}
          {!coachesWithoutTeams.length && <div className="px-4 py-5 text-center text-sm text-textMuted">{t("admin.everyoneHasTeam")}</div>}
        </div>
      </section>

      {isFullAdmin && <PlatformInvitationCreator clubs={(clubs ?? []).map((club) => ({
        id: club.id,
        name: club.name,
        teams: (club.club_teams ?? []).map((team) => ({
          id: team.id,
          name: team.name,
          players: (team.teams ?? []).flatMap((operationalTeam) => operationalTeam.players ?? [])
            .filter((player) => player.role === "player")
            .map((player) => ({ id: player.id, name: `${player.first_name} ${player.last_name}`.trim() }))
        }))
      }))} />}

      <details className="group/users mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
          <span>
            <strong className="block text-lg text-textBright">Alle geregistreerde gebruikers</strong>
            <span className="text-sm text-textMuted">{coaches.length} gebruikers</span>
          </span>
          <span className="text-accent transition-transform group-open/users:rotate-90">▶</span>
        </summary>
        <div className="border-t border-borderSubtle">
          <div className="flex justify-end px-4 py-3">
            <Link href="/dashboard/admin/videos" className="text-accent text-sm hover:underline">
              {t("admin.viewVideos")}
            </Link>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-cardDeep text-textMuted uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">{t("admin.coach")}</th>
              <th className="text-left px-4 py-3">{t("admin.joined")}</th>
              <th className="text-left px-4 py-3">Functie</th>
              <th className="text-left px-4 py-3">Laatste login</th>
              <th className="text-left px-4 py-3">{t("admin.colClub")}</th>
              <th className="text-right px-4 py-3">{t("common.teams")}</th>
              <th className="text-right px-4 py-3">{t("admin.players")}</th>
              <th className="text-right px-4 py-3">{t("admin.videos")}</th>
              <th className="text-right px-4 py-3">{t("common.clips")}</th>
              <th className="text-right px-4 py-3">{t("admin.storage")}</th>
              <th className="text-left px-4 py-3">{t("admin.plan")}</th>
              <th className="text-left px-4 py-3">{t("admin.status")}</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((coach) => (
              <tr key={coach.id} className="border-t border-borderSubtle hover:bg-cardHover">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/admin/coaches/${coach.id}`} className="text-textPrimary hover:text-accent">
                    <div className="font-medium">{coach.full_name || coach.email}</div>
                    <div className="text-textMuted text-xs">{coach.email}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-textSecondary">{new Date(coach.created_at).toLocaleDateString(locale)}</td>
                <td className="px-4 py-3 text-textSecondary">{formatFunctions(coach.functionRoles)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-textSecondary">{formatLastLogin(coach.last_sign_in_at, locale)}</td>
                <td className="px-4 py-3 text-textSecondary">{coach.clubNames.join(", ") || "–"}</td>
                <td className="px-4 py-3 text-right text-textSecondary" title={coach.teamNames.join(", ")}>{coach.teamCount}</td>
                <td className="px-4 py-3 text-right text-textSecondary">{coach.playerCount}</td>
                <td className="px-4 py-3 text-right text-textSecondary">
                  {coach.videoCount}
                  {coach.failedVideoCount > 0 && <span className="text-red-400"> {t("admin.failedCount", { count: coach.failedVideoCount })}</span>}
                </td>
                <td className="px-4 py-3 text-right text-textSecondary">{coach.clipCount}</td>
                <td className="px-4 py-3 text-right text-textSecondary">{formatBytes(coach.storageBytes)}</td>
                <td className="px-4 py-3">
                  <PlanBadge email={coach.email} plan={coach.plan} accountRole={coach.account_role} />
                </td>
                <td className="px-4 py-3">
                  {isBanned(coach.banned_until) ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-semibold">{t("admin.blocked")}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-semibold">{t("admin.active")}</span>
                  )}
                </td>
              </tr>
            ))}

            {coaches.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-textMuted">
                  {t("admin.noneCoaches")}
                </td>
              </tr>
            )}
          </tbody>
          </table>
          </div>
        </div>
      </details>
    </div>
  );
}

function relationValue<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatFunctions(keys: string[] | undefined) {
  if (!keys?.length) return "—";
  return keys.map((key) => CLUB_FUNCTION_ROLES.find(([value]) => value === key)?.[1] || key).join(", ");
}

function formatLastLogin(value: string | null | undefined, locale: string) {
  return value ? new Date(value).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "Nog nooit";
}

function StatTile({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className={`text-2xl font-display ${warn ? "text-red-400" : "text-textBright"}`}>{value}</div>
      <div className="text-textMuted text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
