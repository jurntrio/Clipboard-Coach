import { resolveClubLogo, resolveClubLogoById } from "@/lib/belgian-clubs/resolve-club-logo";
import { ClubLogoImage } from "./ClubLogoImage";

// Server component: resolves the logo itself (DB-backed), then hands off to
// the shared presentational piece. Accepts either identifier a caller might
// already have - a Belgian club's own stamnummer (e.g. the admin screen), or
// a matches.team_a/b_belgian_club_id uuid (belgian_clubs.id) - so call sites
// never need an extra join just to get a stamnummer.
export async function ClubLogo({
  stamnummer,
  belgianClubId,
  naam,
  purpose,
  className
}: {
  stamnummer?: number | null;
  belgianClubId?: string | null;
  naam?: string;
  purpose: "ui" | "display";
  className?: string;
}) {
  const logo = belgianClubId
    ? await resolveClubLogoById(belgianClubId, purpose)
    : await resolveClubLogo(stamnummer, purpose);

  return <ClubLogoImage logo={logo} naam={naam} purpose={purpose} className={className} />;
}
