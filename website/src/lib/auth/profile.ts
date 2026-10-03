import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// Share fresh profile data within a server render, never between users/requests.
export const getAccountProfile = cache(async (userId: string) => {
  const { data } = await createAdminClient().from("profiles")
    .select("account_role, trainer_onboarding_completed_at, full_name").eq("id", userId).maybeSingle();
  return data;
});
