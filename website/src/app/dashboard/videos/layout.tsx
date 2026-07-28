import { requireClubModule, requireClubPermission } from "@/lib/auth/club-module";

export default async function VideosLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("video_viewer");
  await requireClubPermission("video.view");
  return children;
}
