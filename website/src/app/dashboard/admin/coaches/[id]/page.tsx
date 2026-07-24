import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { getPlayerDisplayName } from "@/lib/utils";
import { cloudVideoBytes, getCoachDetail, isBanned } from "../../data";
import { PlanBadge } from "../../PlanBadge";
import { AccountActions } from "./AccountActions";
import { TrainerAssignmentEditor } from "./TrainerAssignmentEditor";
import { getServerI18n } from "@/i18n/server";

const statusStyles: Record<string, string> = {
  ready: "bg-accent/15 text-accent",
  processing: "bg-blue-500/15 text-blue-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  failed: "bg-red-500/15 text-red-400"
};

export default async function AdminCoachDetailPage({ params }: { params: { id: string } }) {
  const coach = await getCoachDetail(params.id);
  if (!coach) notFound();
  const { locale, t } = getServerI18n();

  const blocked = isBanned(coach.banned_until);
  const storageBytes = coach.videos.reduce((sum, video) => sum + cloudVideoBytes(video), 0) + coach.clipStorageBytes;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SectionHeader title={t("admin.coach")} artworkSrc="/branding/teams.png" backHref="/dashboard/admin" />

      <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-textBright font-semibold text-lg">{coach.profile.full_name || coach.profile.email}</h2>
            <PlanBadge email={coach.profile.email} plan={coach.profile.plan} accountRole={coach.profile.account_role} />
            {blocked && <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-semibold">{t("admin.blocked")}</span>}
          </div>
          <p className="text-textMuted text-sm">{coach.profile.email}</p>
          <p className="text-textMuted text-xs mt-1">
            {t("admin.joined")} {new Date(coach.profile.created_at).toLocaleDateString(locale)}
            {coach.last_sign_in_at && <> · {t("admin.lastSignIn", { date: new Date(coach.last_sign_in_at).toLocaleString(locale) })}</>}
            {!coach.email_confirmed_at && <> · {t("admin.emailUnconfirmed")}</>}
          </p>
        </div>
        <AccountActions coachId={coach.profile.id} email={coach.profile.email} banned={blocked} plan={coach.profile.plan} accountRole={coach.profile.account_role} />
      </div>

      <TrainerAssignmentEditor profileId={coach.profile.id} fullName={coach.profile.full_name || ""} clubs={coach.clubOptions} assignment={coach.clubAssignment} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <SummaryTile label={t("common.teams")} value={coach.teams.length} />
        <SummaryTile label={t("admin.videos")} value={coach.videos.length} />
        <SummaryTile label={t("common.clips")} value={coach.clipCount} />
        <SummaryTile label={t("admin.storage")} value={formatBytes(storageBytes)} />
      </div>

      <h3 className="text-textBright font-semibold mb-3">{t("common.teams")}</h3>
      <div className="flex flex-col gap-3 mb-8">
        {coach.teams.map((team) => (
          <div key={team.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <strong className="text-textCardTitle">{team.name}</strong>
              <span className="text-textMuted text-xs">{t("admin.playerCount", { count: team.players.length })}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {team.players.map((player) => (
                <span key={player.id} className="px-2 py-0.5 rounded bg-cardAlt text-textSecondary text-xs">
                  {getPlayerDisplayName(player)}
                </span>
              ))}
            </div>
          </div>
        ))}
        {coach.teams.length === 0 && <p className="text-textMuted text-sm">{t("admin.noneTeams")}</p>}
      </div>

      <h3 className="text-textBright font-semibold mb-3">{t("admin.videos")}</h3>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cardDeep text-textMuted uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">{t("admin.video")}</th>
              <th className="text-left px-4 py-3">{t("admin.uploaded")}</th>
              <th className="text-right px-4 py-3">{t("admin.cloudSize")}</th>
              <th className="text-left px-4 py-3">{t("admin.status")}</th>
            </tr>
          </thead>
          <tbody>
            {coach.videos.map((video) => (
              <tr key={video.id} className="border-t border-borderSubtle">
                <td className="px-4 py-3 text-textPrimary">
                  {video.title || (video.home_team && video.away_team ? `${video.home_team} vs ${video.away_team}` : t("admin.untitled"))}
                </td>
                <td className="px-4 py-3 text-textSecondary">{new Date(video.created_at).toLocaleString(locale)}</td>
                <td className="px-4 py-3 text-right text-textSecondary">
                  {video.video_url.startsWith("local://") ? t("admin.localOnly") : formatBytes(cloudVideoBytes(video))}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusStyles[video.processing_status] ?? ""}`}>
                    {video.processing_status}
                  </span>
                  {video.processing_error && <div className="text-red-400 text-xs mt-1 max-w-xs">{video.processing_error}</div>}
                </td>
              </tr>
            ))}
            {coach.videos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-textMuted">
                  {t("admin.noneVideos")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className="text-2xl font-display text-textBright">{value}</div>
      <div className="text-textMuted text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
