import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles Supabase's email-confirmation / magic-link redirect.
// Configure this URL (https://yourdomain.com/auth/callback) as a redirect URL
// in Supabase: Authentication > URL Configuration.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
