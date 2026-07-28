import { requireClubModule, requireClubPermission } from "@/lib/auth/club-module";

export default async function IntradeskLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("intradesk");
  await requireClubPermission("intradesk.view");
  return children;
}
