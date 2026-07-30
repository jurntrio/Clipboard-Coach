import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/legal-acceptance";

// Handles Supabase's email-confirmation / magic-link redirect.
// Configure this URL (https://yourdomain.com/auth/callback) as a redirect URL
// in Supabase: Authentication > URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const isPasswordRecovery = next === "/reset-password";
    if (data.user && !isPasswordRecovery) {
      try {
        if (!await hasCurrentLegalAcceptance(data.user.id)) {
          return NextResponse.redirect(`${origin}/legal-consent`);
        }
      } catch (error) {
        console.error("Failed to check legal acceptance after authentication", error);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=legal-check`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
