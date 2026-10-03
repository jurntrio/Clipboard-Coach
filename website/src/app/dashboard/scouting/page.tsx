import { pageTitle } from "@/lib/page-metadata";
import { UnderConstructionPage } from "@/components/ui/UnderConstructionPage";
import { redirect } from "next/navigation";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export default async function ScoutingPage() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) redirect("/dashboard");
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(access, "games.scouting.view")) redirect("/dashboard");
  return <UnderConstructionPage title="Scouting" description="De centrale scoutingmodule wordt momenteel voorbereid." icon="/branding/cbcs_black_icons/scouting.png" />;
}

export const generateMetadata = pageTitle("page.scouting");
