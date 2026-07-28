import { requireClubModule } from "@/lib/auth/club-module";

export default async function IntradeskLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("intradesk");
  return children;
}
