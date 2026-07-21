import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { getPlayerDisplayName } from "@/lib/utils";
import { getCoachDetail, isBanned } from "../../data";
import { PlanBadge } from "../../PlanBadge";
import { AccountActions } from "./AccountActions";

const statusStyles: Record<string, string> = {
  ready: "bg-accent/15 text-accent",
  processing: "bg-blue-500/15 text-blue-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  failed: "bg-red-500/15 text-red-400"
};

export default async function AdminCoachDetailPage({ params }: { params: { id: string } }) {
  const coach = await getCoachDetail(params.id);
  if (!coach) notFound();

  const blocked = isBanned(coach.banned_until);
  const storageBytes = coach.videos.reduce((sum, v) => sum + (v.file_size ?? 0), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <SectionHeader title="Coach" artworkSrc="/branding/teams.png" />

      <div className="flex justify-end mb-3">
        <Link href="/dashboard/admin" className="text-accent text-sm hover:underline">
          &larr; Back to admin overview
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-textBright font-semibold text-lg">{coach.profile.full_name || coach.profile.email}</h2>
            <PlanBadge email={coach.profile.email} plan={coach.profile.plan} />
            {blocked && <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-semibold">Blocked</span>}
          </div>
          <p className="text-textMuted text-sm">{coach.profile.email}</p>
          <p className="text-textMuted text-xs mt-1">
            Joined {new Date(coach.profile.created_at).toLocaleDateString()}
            {coach.last_sign_in_at && <> · Last sign-in {new Date(coach.last_sign_in_at).toLocaleString()}</>}
            {!coach.email_confirmed_at && <> · Email unconfirmed</>}
          </p>
        </div>
        <AccountActions coachId={coach.profile.id} email={coach.profile.email} banned={blocked} plan={coach.profile.plan} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <SummaryTile label="Teams" value={coach.teams.length} />
        <SummaryTile label="Videos" value={coach.videos.length} />
        <SummaryTile label="Clips" value={coach.clipCount} />
        <SummaryTile label="Storage" value={formatBytes(storageBytes)} />
      </div>

      <h3 className="text-textBright font-semibold mb-3">Teams</h3>
      <div className="flex flex-col gap-3 mb-8">
        {coach.teams.map((team) => (
          <div key={team.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <strong className="text-textCardTitle">{team.name}</strong>
              <span className="text-textMuted text-xs">{team.players.length} players</span>
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
        {coach.teams.length === 0 && <p className="text-textMuted text-sm">No teams yet.</p>}
      </div>

      <h3 className="text-textBright font-semibold mb-3">Videos</h3>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cardDeep text-textMuted uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Video</th>
              <th className="text-left px-4 py-3">Uploaded</th>
              <th className="text-right px-4 py-3">Size</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {coach.videos.map((video) => (
              <tr key={video.id} className="border-t border-borderSubtle">
                <td className="px-4 py-3 text-textPrimary">
                  {video.title || (video.home_team && video.away_team ? `${video.home_team} vs ${video.away_team}` : "Untitled")}
                </td>
                <td className="px-4 py-3 text-textSecondary">{new Date(video.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-textSecondary">{formatBytes(video.file_size)}</td>
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
                  No videos yet.
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
