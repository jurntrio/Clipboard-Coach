import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ isAdmin: false, isAdminViewer: false }, { status: 401 });
  if (isAdminEmail(user.email)) return NextResponse.json({ isAdmin: true, isAdminViewer: true });
  const { data: profile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  return NextResponse.json({
    isAdmin: profile?.account_role === "platform_admin",
    isAdminViewer: profile?.account_role === "admin_viewer"
  });
}
