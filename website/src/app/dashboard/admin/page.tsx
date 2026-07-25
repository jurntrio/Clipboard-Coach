import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { getCoachOverviews, isBanned } from "./data";
import { PlanBadge } from "./PlanBadge";
import { getServerI18n } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminOverviewPage() {
  const admin = createAdminClient();
  const [coaches, { data: clubs }] = await Promise.all([
    getCoachOverviews(),
    admin
      .from("clubs")
      .select("id, name, rbfa_registration_number, club_memberships(profile_id, role), club_trainers(id, profile_id, display_name, phone_number, invitation_status, profiles(email), club_trainer_teams(club_teams(name)))")
      .order("name")
  ]);
  const { locale, t } = getServerI18n();
  const coachesWithoutTeams = coaches.filter((coach) => coach.teamCount === 0);

  const totals = coaches.reduce(
    (acc, c) => ({
      teams: acc.teams + c.teamCount,
      videos: acc.videos + c.videoCount,
      failed: acc.failed + c.failedVideoCount,
      clips: acc.clips + c.clipCount,
      storage: acc.storage + c.storageBytes
    }),
    { teams: 0, videos: 0, failed: 0, clips: 0, storage: 0 }
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SectionHeader title={t("common.admin")} subtitle={t("admin.subtitle")} artworkSrc="/branding/admin.png" />

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-8">
        <StatTile label={t("admin.coaches")} value={coaches.length} />
        <StatTile label="Clubs" value={clubs?.length ?? 0} />
        <StatTile label={t("common.teams")} value={totals.teams} />
        <StatTile label={t("admin.videos")} value={totals.videos} />
        <StatTile label={t("admin.failed")} value={totals.failed} warn={totals.failed > 0} />
        <StatTile label={t("common.clips")} value={totals.clips} />
        <StatTile label={t("admin.storage")} value={formatBytes(totals.storage)} />
      </div>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-textBright">Clubbeheer</h2>
            <p className="mt-1 text-sm text-textMuted">
              Bekijk bestaande clubs, voeg een club toe en wijs een Club Admin of Analyst toe.
            </p>
          </div>
          <Link
            href="/dashboard/admin/clubs"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page hover:brightness-110"
          >
            Clubs bekijken en toevoegen
          </Link>
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
            return (
              <details key={club.id} className="group rounded-lg border border-borderSubtle bg-cardDeep">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="font-medium text-textPrimary">{club.name}</div>
                    <div className="mt-1 text-xs text-textMuted">
                      {club.rbfa_registration_number ? `RBFA ${club.rbfa_registration_number}` : "Geen stamnummer"}
                      {" · "}
                      {trainers.length === 1 ? "1 trainer" : `${trainers.length} trainers`}
                      {" · "}
                      {clubAdminCount === 1 ? "1 Club Admin" : `${clubAdminCount} Club Admins`}
                    </div>
                  </div>
                  <span className="text-accent transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                </summary>
                <div className="overflow-x-auto border-t border-borderSubtle">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="text-xs uppercase text-textMuted">
                      <tr><th className="px-4 py-2 text-left">Naam</th><th className="px-4 py-2 text-left">Ploeg(en)</th><th className="px-4 py-2 text-left">GSM</th><th className="px-4 py-2 text-left">E-mail</th></tr>
                    </thead>
                    <tbody>
                      {trainers.map((trainer) => (
                        <tr key={trainer.id} className="border-t border-borderSubtle">
                          <td className="px-4 py-2 text-textPrimary">{trainer.display_name}{trainer.invitation_status !== "linked" && <span className="ml-2 text-xs text-amber-300">Nog te koppelen</span>}</td>
                          <td className="px-4 py-2 text-textSecondary">{trainer.club_trainer_teams.map((link) => relationValue(link.club_teams)?.name).filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-4 py-2 text-textSecondary">{trainer.phone_number || "—"}</td>
                          <td className="px-4 py-2 text-textSecondary">{relationValue(trainer.profiles)?.email || "—"}</td>
                        </tr>
                      ))}
                      {!trainers.length && <tr><td colSpan={4} className="px-4 py-4 text-center text-textMuted">Nog geen trainers toegewezen.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
          {!clubs?.length && (
            <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-textMuted">
              Nog geen clubs toegevoegd.
            </div>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-textBright">Gebruikers zonder ploeg</h2>
            <p className="mt-1 text-sm text-textMuted">Deze gebruikers hebben nog geen gewone ploeg of clubploeg toegewezen gekregen.</p>
          </div>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">{coachesWithoutTeams.length}</span>
        </div>
        <div className="mt-4 divide-y divide-borderSubtle rounded-lg border border-borderSubtle bg-cardDeep">
          {coachesWithoutTeams.map((coach) => (
            <div key={coach.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div><div className="font-medium text-textPrimary">{coach.full_name || coach.email}</div><div className="text-xs text-textMuted">{coach.email}</div></div>
              <Link href={`/dashboard/admin/coaches/${coach.id}`} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textPrimary hover:border-accent hover:text-accent">Ploeg toewijzen</Link>
            </div>
          ))}
          {!coachesWithoutTeams.length && <div className="px-4 py-5 text-center text-sm text-textMuted">Iedere gebruiker heeft minstens één ploeg.</div>}
        </div>
      </section>

      <div className="flex justify-end mb-3">
        <Link href="/dashboard/admin/videos" className="text-accent text-sm hover:underline">
          {t("admin.viewVideos")}
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cardDeep text-textMuted uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">{t("admin.coach")}</th>
              <th className="text-left px-4 py-3">{t("admin.joined")}</th>
              <th className="text-left px-4 py-3">Club</th>
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
                <td colSpan={10} className="px-4 py-6 text-center text-textMuted">
                  {t("admin.noneCoaches")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function relationValue<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function StatTile({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className={`text-2xl font-display ${warn ? "text-red-400" : "text-textBright"}`}>{value}</div>
      <div className="text-textMuted text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
