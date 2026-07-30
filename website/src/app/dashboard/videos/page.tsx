import { MatchLauncher } from "@/components/videos/MatchLauncher";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";

export default async function VideosPage() {
  const context = await getClubContext();
  const access = context.user && context.activeClubId ? await getClubAccess(context.activeClubId, context.user) : null;
  const canCreateMatch = !!access && ["club_admin", "platform_admin"].includes(access.role);
  return <MatchLauncher canCreateMatch={canCreateMatch} />;
}
