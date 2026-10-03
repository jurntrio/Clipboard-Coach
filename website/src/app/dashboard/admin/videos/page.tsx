import { pageTitle } from "@/lib/page-metadata";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatBytes } from "@/lib/utils";
import { getAllVideos, cloudVideoBytes } from "../data";
import { getServerI18n } from "@/i18n/server";

const statusStyles: Record<string, string> = {
  ready: "bg-accent/15 text-accent",
  processing: "bg-blue-500/15 text-blue-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  failed: "bg-red-500/15 text-red-400"
};

export default async function AdminVideosPage() {
  const videos = await getAllVideos();
  const { locale, t } = getServerI18n();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SectionHeader title={t("admin.videos")} subtitle={t("admin.allVideosSubtitle")} artworkSrc="/branding/video-viewer.webp" />

      <div className="flex justify-end mb-3">
        <Link href="/dashboard/admin" className="text-accent text-sm hover:underline">
          {t("admin.backOverview")}
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cardDeep text-textMuted uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">{t("admin.video")}</th>
              <th className="text-left px-4 py-3">{t("admin.coach")}</th>
              <th className="text-left px-4 py-3">{t("admin.uploaded")}</th>
              <th className="text-right px-4 py-3">{t("admin.cloudSize")}</th>
              <th className="text-left px-4 py-3">{t("admin.status")}</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr key={video.id} className="border-t border-borderSubtle hover:bg-cardHover align-top">
                <td className="px-4 py-3 text-textPrimary">
                  {video.title || (video.home_team && video.away_team ? `${video.home_team} vs ${video.away_team}` : t("admin.untitled"))}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/admin/coaches/${video.coach_id}`} className="text-textSecondary hover:text-accent">
                    {video.coach_email}
                  </Link>
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

            {videos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-textMuted">
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

export const generateMetadata = pageTitle("page.adminVideos");
