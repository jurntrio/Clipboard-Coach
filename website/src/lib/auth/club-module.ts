import { redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ClubModuleKey } from "@/lib/club-modules";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import type { ClubPermissionKey } from "@/lib/club-access-options";

async function loadClubModuleConfiguration(supabase: SupabaseClient, clubId: string) {
  const { data } = await supabase
    .from("club_module_entitlements")
    .select("module_key, enabled")
    .eq("club_id", clubId);
  return {
    configured: !!data?.length,
    enabled: new Set((data ?? []).filter((item) => item.enabled).map((item) => item.module_key as ClubModuleKey))
  };
}

export const getClubModuleConfiguration = cache(async (clubId: string) => loadClubModuleConfiguration(createClient(), clubId));

// API-route guard: is this module enabled for the club, checked against the
// caller-supplied client (use an admin client for public/unauthenticated
// routes where RLS on club_module_entitlements would otherwise hide the row).
export async function isClubModuleEnabled(clubId: string, moduleKey: ClubModuleKey, supabase: SupabaseClient = createClient()) {
  const modules = await loadClubModuleConfiguration(supabase, clubId);
  return !modules.configured || modules.enabled.has(moduleKey);
}

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
