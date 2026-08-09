import type { Metadata } from "next";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/invite-tokens";

const siteUrl = "https://app.sportvisualsystems.com";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const { data: invite } = await createAdminClient().from("club_registration_invites")
    .select("expected_name, function_role, target_account_role, expires_at, used_at, clubs(name), club_teams(name)")
    .eq("token_hash", hashInviteToken(params.token)).maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return preview("Uitnodiging voor Sport Visual Systems", "Open de link om de status van deze uitnodiging te bekijken.");
  }

  const club = invite.clubs as unknown as { name: string } | null;
  const team = invite.club_teams as unknown as { name: string } | null;
  const platformLabel = invite.target_account_role === "platform_admin" ? "Admin"
    : invite.target_account_role === "admin_viewer" ? "Admin (viewer)" : null;
  const role = platformLabel || CLUB_FUNCTION_ROLES.find(([key]) => key === invite.function_role)?.[1] || "clublid";
  const title = invite.expected_name
    ? `${invite.expected_name}, je bent uitgenodigd`
    : `Uitnodiging voor ${club?.name || "Sport Visual Systems"}`;
  const context = [club?.name, team?.name].filter(Boolean).join(" · ");
  return preview(title, `Registreer als ${role}${context ? ` bij ${context}` : ""}. Deze persoonlijke link kan één keer worden gebruikt.`);
}

function preview(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "Sport Visual Systems",
      title,
      description,
      images: [{ url: `${siteUrl}/branding/banner.png`, alt: "Sport Visual Systems" }]
    },
    twitter: { card: "summary_large_image", title, description, images: [`${siteUrl}/branding/banner.png`] }
  };
}

export default function ClubInviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
