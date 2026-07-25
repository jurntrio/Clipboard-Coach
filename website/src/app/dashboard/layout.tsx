import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: acceptance } = await supabase
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", user.id)
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .eq("statement_version", LEGAL_STATEMENT_VERSION)
    .limit(1)
    .maybeSingle();

  if (!acceptance) {
    redirect("/legal-consent");
  }

  return <div className="flex min-h-screen flex-col bg-page"><main className="flex-1">{children}</main><footer className="mt-auto border-t border-border px-5 py-6"><LegalLinks /></footer></div>;
}
