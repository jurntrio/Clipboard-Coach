import { redirect } from "next/navigation";
import { LegalConsentForm } from "@/components/legal/LegalConsentForm";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export default async function LegalConsentPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: acceptance } = await supabase
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", user.id)
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .eq("statement_version", LEGAL_STATEMENT_VERSION)
    .limit(1)
    .maybeSingle();

  if (acceptance) redirect("/dashboard");
  return <LegalConsentForm />;
}
