import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/invite-tokens";

const siteUrl = "https://app.sportvisualsystems.com";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const admin = createAdminClient();
  const { data: invite } = await admin.from("player_invites")
    .select("player_id, club_player_id, expires_at, used_at")
    .eq("token_hash", hashInviteToken(params.token)).maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return preview("Uitnodiging als verantwoordelijke", "Open de link om de status van deze uitnodiging te bekijken.");
  }

  let playerName = "een speler";
  let teamName = "";
  if (invite.club_player_id) {
    const [{ data: player }, { data: memberships }] = await Promise.all([
      admin.from("club_players").select("first_name, last_name").eq("id", invite.club_player_id).maybeSingle(),
      admin.from("player_team_memberships").select("teams(name)").eq("club_player_id", invite.club_player_id).eq("status", "active")
    ]);
    if (player) playerName = `${player.first_name} ${player.last_name}`.trim();
    teamName = (memberships ?? []).map((membership) => (membership.teams as unknown as { name: string } | null)?.name).filter(Boolean).join(", ");
  } else if (invite.player_id) {
    const { data: player } = await admin.from("players").select("first_name, last_name, teams(name)").eq("id", invite.player_id).maybeSingle();
    if (player) {
      playerName = `${player.first_name} ${player.last_name}`.trim();
      teamName = (player.teams as unknown as { name: string } | null)?.name ?? "";
    }
  }

  return preview(
    `Uitnodiging als verantwoordelijke van ${playerName}`,
    `Koppel je account aan ${playerName}${teamName ? ` van ${teamName}` : ""}. Deze persoonlijke link kan één keer worden gebruikt.`
  );
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

export default function PlayerInviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
