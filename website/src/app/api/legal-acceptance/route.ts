import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/legal-acceptance";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accepted = await hasCurrentLegalAcceptance(user.id);
    return NextResponse.json({ accepted });
  } catch (error) {
    console.error("Failed to check legal acceptance during authentication", error);
    return NextResponse.json({ error: "legal_acceptance_check_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const locale = isLocale(body?.locale) ? body.locale : "nl";
  const admin = createAdminClient();
  const { error } = await admin.from("legal_acceptances").insert({
    user_id: user.id,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    statement_version: LEGAL_STATEMENT_VERSION,
    locale,
    accepted_at: new Date().toISOString()
  });

  if (error) {
    console.error("Failed to record renewed legal acceptance", error);
    return NextResponse.json({ error: "legal_acceptance_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
