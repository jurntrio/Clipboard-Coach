import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { getCoachOverviews, isBanned } from "./data";

export default async function AdminOverviewPage() {
  const coaches = await getCoachOverviews();

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
    <div className="p-8 max-w-6xl mx-auto">
      <SectionHeader title="Admin" subtitle="Coaches, teams and storage across all accounts" artworkSrc="/branding/admin.png" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        <StatTile label="Coaches" value={coaches.length} />
        <StatTile label="Teams" value={totals.teams} />
        <StatTile label="Videos" value={totals.videos} />
        <StatTile label="Failed" value={totals.failed} warn={totals.failed > 0} />
        <StatTile label="Clips" value={totals.clips} />
        <StatTile label="Storage" value={formatBytes(totals.storage)} />
      </div>

      <div className="flex justify-end mb-3">
        <Link href="/dashboard/admin/videos" className="text-accent text-sm hover:underline">
          View all videos &rarr;
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cardDeep text-textMuted uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Coach</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-right px-4 py-3">Teams</th>
              <th className="text-right px-4 py-3">Players</th>
              <th className="text-right px-4 py-3">Videos</th>
              <th className="text-right px-4 py-3">Clips</th>
              <th className="text-right px-4 py-3">Storage</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Status</th>
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
                <td className="px-4 py-3 text-textSecondary">{new Date(coach.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right text-textSecondary">{coach.teamCount}</td>
                <td className="px-4 py-3 text-right text-textSecondary">{coach.playerCount}</td>
                <td className="px-4 py-3 text-right text-textSecondary">
                  {coach.videoCount}
                  {coach.failedVideoCount > 0 && <span className="text-red-400"> ({coach.failedVideoCount} failed)</span>}
                </td>
                <td className="px-4 py-3 text-right text-textSecondary">{coach.clipCount}</td>
                <td className="px-4 py-3 text-right text-textSecondary">{formatBytes(coach.storageBytes)}</td>
                <td className="px-4 py-3">
                  {coach.plan === "pro" ? (
                    <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-semibold">Pro</span>
                  ) : (
                    <span className="text-textMuted text-xs">Free</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isBanned(coach.banned_until) ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-semibold">Blocked</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-semibold">Active</span>
                  )}
                </td>
              </tr>
            ))}

            {coaches.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-textMuted">
                  No coaches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <div className={`text-2xl font-display ${warn ? "text-red-400" : "text-textBright"}`}>{value}</div>
      <div className="text-textMuted text-xs uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
