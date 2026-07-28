import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { ClubModuleKey } from "@/lib/club-modules";
import { getClubContext } from "@/lib/auth/active-club";

export async function requireClubModule(moduleKey: ClubModuleKey) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) return;
  const context = await getClubContext();
  if (!context.activeClubId) return;
  const { data: allowed } = await supabase.from("club_module_entitlements")
    .select("club_id").eq("club_id", context.activeClubId)
    .eq("module_key", moduleKey).eq("enabled", true).limit(1).maybeSingle();
  if (!allowed) redirect("/dashboard");
}
