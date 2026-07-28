import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { isAdminEmail } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { ClubDashboard } from "./ClubDashboard";
import { requireClubModule } from "@/lib/auth/club-module";

export default async function ClubPage() {
  await requireClubModule("club_management");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  if (!isAdminEmail(user.email) && profile?.account_role !== "club_admin") redirect("/dashboard");

  return <div className="mx-auto max-w-7xl p-8"><SectionHeader title="Clubbeheer" subtitle="Beheer trainers, ploegen en toegang tot wedstrijden." artworkSrc="/branding/teams.png" /><ClubDashboard /></div>;
}
