import { requireClubFeature } from "@/lib/auth/club-module";

export default async function IntradeskLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("intradesk", "intradesk.view");
  return children;
}
