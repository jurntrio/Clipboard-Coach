import { requireClubFeature } from "@/lib/auth/club-module";

export default async function MatchesLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("matches");
  return children;
}
