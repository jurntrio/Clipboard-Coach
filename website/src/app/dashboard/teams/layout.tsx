import { requireClubModule } from "@/lib/auth/club-module";

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("teams");
  return children;
}
