import { requireClubModule, requireClubPermission } from "@/lib/auth/club-module";

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("teams");
  await requireClubPermission("teams.view");
  return children;
}
