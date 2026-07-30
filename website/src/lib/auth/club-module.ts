import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ClubModuleKey } from "@/lib/club-modules";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import type { ClubPermissionKey } from "@/lib/club-access-options";

export const getClubModuleConfiguration = cache(async (clubId: string) => {
  const { data } = await createClient()
    .from("club_module_entitlements")
    .select("module_key, enabled")
    .eq("club_id", clubId);
  return {
    configured: !!data?.length,
    enabled: new Set((data ?? []).filter((item) => item.enabled).map((item) => item.module_key as ClubModuleKey))
  };
});

export async function requireClubFeature(moduleKey: ClubModuleKey, permission?: ClubPermissionKey) {
  const context = await getClubContext();
  if (!context.user) redirect("/login");
  if (context.isPlatformAdmin) return;
  if (!context.activeClubId) return;

  const [modules, access] = await Promise.all([
    getClubModuleConfiguration(context.activeClubId),
    permission ? getClubAccess(context.activeClubId, context.user) : Promise.resolve(null)
  ]);
  if (!modules.enabled.has(moduleKey)) redirect("/dashboard");
  if (permission && (!access || !hasClubPermission(access, permission))) redirect("/dashboard");
}
