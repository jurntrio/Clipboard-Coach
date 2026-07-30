import { requireClubFeature } from "@/lib/auth/club-module";

export default async function VideosLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("video_viewer", "video.view");
  return children;
}
