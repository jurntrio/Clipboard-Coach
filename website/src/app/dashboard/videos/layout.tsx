import { requireClubModule } from "@/lib/auth/club-module";

export default async function VideosLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("video_viewer");
  return children;
}
