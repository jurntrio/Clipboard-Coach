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

// Server-only guard: redirects non-admins back to the dashboard. Call this at
// the top of every admin page/layout/action, since layouts alone don't
// protect server actions invoked directly.
export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect("/dashboard");
  }

  return user!;
}
