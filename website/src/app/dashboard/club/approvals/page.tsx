import { pageTitle } from "@/lib/page-metadata";
import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { requireClubFeature } from "@/lib/auth/club-module";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { ClubApprovals } from "./ClubApprovals";

export default async function ClubApprovalsPage() {
  await requireClubFeature("club_management");
  const context = await getClubContext();
  if (!context.user) redirect("/login");
  if (!context.activeClubId) redirect("/dashboard");
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!["club_admin", "platform_admin"].includes(access.role) && !hasClubPermission(access, "teams.manage_all")) redirect("/dashboard/club");
  return <div className="mx-auto max-w-5xl p-8">
    <SectionHeader title="Aanvragen & goedkeuringen" subtitle="Beoordeel openstaande aanvragen voor de actieve club." artworkSrc="/branding/clubadmin.webp" backHref="/dashboard/club" />
    <ClubApprovals />
  </div>;
}

export const generateMetadata = pageTitle("page.clubApprovals");
