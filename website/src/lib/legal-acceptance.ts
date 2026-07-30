import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export async function hasCurrentLegalAcceptance(userId: string) {
  const { data, error } = await createAdminClient()
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .eq("statement_version", LEGAL_STATEMENT_VERSION)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}
