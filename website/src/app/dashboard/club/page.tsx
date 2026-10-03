import { pageTitle } from "@/lib/page-metadata";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { ClubDashboard } from "./ClubDashboard";
import { requireClubFeature } from "@/lib/auth/club-module";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export default async function ClubPage() {
  await requireClubFeature("club_management");
  const supabase = createClient();
  const { user, activeClubId } = await getClubContext();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  const access = activeClubId ? await getClubAccess(activeClubId, user) : null;
  const hasManagementAccess = access && (hasClubPermission(access, "teams.manage") || hasClubPermission(access, "teams.import"));
  if (!isAdminEmail(user.email) && profile?.account_role !== "platform_admin" && profile?.account_role !== "club_admin" && !hasManagementAccess) redirect("/dashboard");

  return <div className="mx-auto max-w-7xl p-8"><ClubDashboard /></div>;
}

export const generateMetadata = pageTitle("page.club");
