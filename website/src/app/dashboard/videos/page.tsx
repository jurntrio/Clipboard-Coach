import { MatchLauncher } from "@/components/videos/MatchLauncher";
import { getClubContext } from "@/lib/auth/active-club";

export default async function VideosPage() {
  const context = await getClubContext();
  // Club members already schedule matches via Clubbeheer; manual creation here is only
  // for standalone coaches with no club at all.
  const canCreateMatch = !context.activeClubId;
  return <MatchLauncher canCreateMatch={canCreateMatch} />;
}
