import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Comma-separated allowlist. Defaults to the project owner so admin access
// works out of the box; override/extend via the ADMIN_EMAILS env var.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "jurntrio@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Server-only guard for mutating platform actions. Both the owner allowlist
// and explicitly invited platform_admin accounts qualify; admin_viewer never
// does.
export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/dashboard");
  if (isAdminEmail(user.email)) return user;
  const { data: profile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  if (profile?.account_role !== "platform_admin") {
    redirect("/dashboard");
  }

  return user;
}

// Page-level gate for the /dashboard/admin section: lets full admins AND
// read-only admin_viewer accounts in. Every mutation server action still
// calls the strict requireAdmin() above independently, so a viewer landing
// on these pages can look but any write attempt is rejected regardless of
// what the UI shows.
export async function requireAdminOrViewer() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/dashboard");
  if (isAdminEmail(user.email)) return { user, isFullAdmin: true };

  const { data: profile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  if (profile?.account_role === "platform_admin") return { user, isFullAdmin: true };
  if (profile?.account_role !== "admin_viewer") redirect("/dashboard");

  return { user, isFullAdmin: false };
}
