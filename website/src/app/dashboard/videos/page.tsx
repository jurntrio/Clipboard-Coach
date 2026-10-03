import { pageTitle } from "@/lib/page-metadata";
import { MatchLauncher } from "@/components/videos/MatchLauncher";

export default function VideosPage() {
  return <MatchLauncher />;
}

export const generateMetadata = pageTitle("page.videos");
