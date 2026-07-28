import { requireClubModule } from "@/lib/auth/club-module";

export default async function MatchesLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("matches");
  return children;
}
