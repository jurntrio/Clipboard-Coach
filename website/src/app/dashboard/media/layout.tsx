import { redirect } from "next/navigation";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";
import { requireClubFeature } from "@/lib/auth/club-module";

export default async function MediaLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("media");
  const context = await getClubContext();
  if (!context.user) redirect("/login");
  if (!context.isPlatformAdmin && context.activeClubId) {
    const access = await getClubAccess(context.activeClubId, context.user);
    if (!access || !["club_admin", "club_admin_viewer"].includes(access.role)) redirect("/dashboard");
  }
  return children;
}
