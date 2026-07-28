import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { ClubModuleKey } from "@/lib/club-modules";

export async function requireClubModule(moduleKey: ClubModuleKey) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) return;
  const { data: memberships } = await supabase.from("club_memberships")
    .select("club_id").eq("profile_id", user.id).eq("status", "active");
  if (!memberships?.length) return;
  const { data: allowed } = await supabase.from("club_module_entitlements")
    .select("club_id").in("club_id", memberships.map((item) => item.club_id))
    .eq("module_key", moduleKey).eq("enabled", true).limit(1).maybeSingle();
  if (!allowed) redirect("/dashboard");
}
