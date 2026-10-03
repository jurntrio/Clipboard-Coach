import { pageTitle } from "@/lib/page-metadata";
import { requireClubFeature } from "@/lib/auth/club-module";

export default async function MatchesLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("matches");
  return children;
}

export const generateMetadata = pageTitle("page.clips");
