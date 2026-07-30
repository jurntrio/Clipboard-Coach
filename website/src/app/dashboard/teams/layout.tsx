import { requireClubFeature } from "@/lib/auth/club-module";

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("teams", "teams.view");
  return children;
}
