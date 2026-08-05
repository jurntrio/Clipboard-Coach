import { UnderConstructionPage } from "@/components/ui/UnderConstructionPage";
import { redirect } from "next/navigation";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";

export default async function EquipmentPage() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) redirect("/dashboard");
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!["club_admin", "club_admin_viewer", "platform_admin"].includes(access.role) && access.functionRole !== "equipment_manager") redirect("/dashboard");
  return <UnderConstructionPage title="Materiaal" description="Het beheer van materiaal en uitrusting wordt momenteel voorbereid." icon="/branding/cbcs_black_icons/materiaal.png" />;
}
