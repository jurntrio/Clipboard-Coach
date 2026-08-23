import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClubLogoById } from "@/lib/belgian-clubs/resolve-club-logo";
import { isClubModuleEnabled } from "@/lib/auth/club-module";
import { getServerI18n } from "@/i18n/server";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const admin = createAdminClient();
  const { data: screen } = await admin
    .from("club_tv_screens")
    .select(
      "id,club_id,name,location,orientation,transition_effect,slide_duration_seconds,show_clock,active,clubs(name,logo_url),club_tv_blocks(id,block_type,title,display_order,active,configuration)",
    )
    .eq("public_token", params.token)
    .eq("active", true)
    .maybeSingle();
  if (!screen)
    return NextResponse.json(
      { error: "Club-TV-scherm niet gevonden." },
      { status: 404 },
    );
  // Preview requests come from the dashboard, which already gates the
  // "media" module at the page level (including a platform-admin bypass) -
  // only the public, token-based screen playback needs the check here.
  if (!preview && !(await isClubModuleEnabled(screen.club_id, "media", admin))) {
    return NextResponse.json(
      { error: getServerI18n().t("clubModule.mediaDisabled") },
      { status: 403 },
    );
  }
  const all = (screen.club_tv_blocks ?? [])
      .filter((b: any) => b.active)
      .sort((a: any, b: any) => a.display_order - b.display_order),
    header = all.find((b: any) =>
      ["match_header", "match"].includes(b.block_type),
    ),
    tickers = all.filter((b: any) => b.configuration?.persistentTicker === true),
    defaultMatchId = header?.configuration?.matchId;
  const requestedMatchIds = Array.from(
    new Set(
      all
        .map(
          (b: any) =>
            b.configuration?.matchId ||
            (["match_sponsors", "ball_donors"].includes(b.block_type)
              ? defaultMatchId
              : null),
        )
        .filter(Boolean),
    ),
  ) as string[];
  const teamIds = all
    .filter((b: any) => b.block_type === "players")
    .flatMap((b: any) => b.configuration?.teamIds ?? []);
  const { data: selectedClubTeams } = teamIds.length
    ? await admin.from("club_teams").select("id,name").in("id", teamIds)
    : { data: [] };
  const { data: clubTeamCandidates } = selectedClubTeams?.length
    ? await admin
        .from("club_teams")
        .select("id,name")
        .eq("club_id", screen.club_id)
        .in(
          "name",
          Array.from(new Set(selectedClubTeams.map((team) => team.name))),
        )
    : { data: [] };
  const resolvedTeamIds = Array.from(
    new Set([
      ...(teamIds ?? []),
      ...(clubTeamCandidates ?? []).map((team) => team.id),
    ]),
  );
  const [
    { data: matches },
    { data: sponsors },
    { data: teams },
    { data: configs },
  ] = await Promise.all([
    requestedMatchIds.length
      ? admin
          .from("matches")
          .select(
            "id,team_a_name,team_b_name,team_a_belgian_club_id,team_b_belgian_club_id,match_date,start_time,status,score_a,score_b,player_ids,match_dossiers(lineup_notes)",
          )
          .in("id", requestedMatchIds)
          .eq("club_id", screen.club_id)
      : Promise.resolve({ data: [] }),
    admin
      .from("sponsors")
      .select(
        "id,company_name,logo_url,alternate_logo_url,website_url,sponsor_assignments(sponsor_level,status)",
      )
      .eq("club_id", screen.club_id)
      .eq("active", true),
    resolvedTeamIds.length
      ? admin
          .from("teams")
          .select("id,name,club_team_id")
          .in("club_team_id", resolvedTeamIds)
      : Promise.resolve({ data: [] }),
    requestedMatchIds.length
      ? admin
          .from("sponsor_match_configurations")
          .select(
            "match_id,sponsor_match_partners(partner_role,sponsor_id,sponsors(id,company_name,logo_url,alternate_logo_url,website_url))",
          )
          .in("match_id", requestedMatchIds)
          .eq("club_id", screen.club_id)
          .eq("active", true)
      : Promise.resolve({ data: [] }),
  ]);
  const operationalTeamIds = (teams ?? []).map((team: any) => team.id);
  const [{ data: memberships }, { data: legacyPlayers }] =
    operationalTeamIds.length
      ? await Promise.all([
          admin
            .from("player_team_memberships")
            .select("team_id,club_players(id,first_name,last_name,photo_url)")
            .in("team_id", operationalTeamIds)
            .neq("status", "ended"),
          admin
            .from("players")
            .select("id,team_id,first_name,last_name,photo_url,role")
            .in("team_id", operationalTeamIds)
            .eq("role", "player"),
        ])
      : [{ data: [] }, { data: [] }];
  const clubTvTeams = (teams ?? []).map((team: any) => ({
    ...team,
    players: deduplicatePlayers([
      ...(memberships ?? [])
        .filter((membership: any) => membership.team_id === team.id)
        .map((membership: any) => membership.club_players)
        .filter(Boolean),
      ...(legacyPlayers ?? []).filter(
        (player: any) => player.team_id === team.id,
      ),
    ]),
  }));
  const matchesWithLogos = await Promise.all(
    (matches ?? []).map(async (m: any) => ({
      ...m,
      team_a_logo: await resolveClubLogoById(m.team_a_belgian_club_id, "display"),
      team_b_logo: await resolveClubLogoById(m.team_b_belgian_club_id, "display"),
    })),
  );
  const matchMap = new Map(matchesWithLogos.map((m: any) => [m.id, m]));
  const visible = preview
    ? all
    : all.filter((b: any) =>
        isVisible(b, matchMap.get(b.configuration?.matchId || defaultMatchId)),
      );
  return NextResponse.json(
    {
      screen: { ...screen, club_tv_blocks: undefined },
      header:
        header && visible.some((b: any) => b.id === header.id) ? header : null,
      tickers: tickers.filter(
        (ticker: any) => ticker.configuration?.enabled === true && ticker.configuration?.text,
      ),
      // Keep the original field available for older screen clients.
      ticker: tickers.find(
        (ticker: any) => ticker.configuration?.enabled === true && ticker.configuration?.text,
      ) ?? null,
      blocks: visible.filter(
        (b: any) => b.id !== header?.id && !tickers.some((ticker: any) => ticker.id === b.id),
      ),
      matches: Object.fromEntries(matchMap),
      sponsors: sponsors ?? [],
      teams: clubTvTeams,
      matchPartners: configs ?? [],
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

function deduplicatePlayers(players: any[]) {
  const unique = new Map<string, any>();
  for (const player of players) {
    const key =
      `${player.first_name ?? ""}|${player.last_name ?? ""}`.toLocaleLowerCase(
        "nl-BE",
      );
    const existing = unique.get(key);
    if (!existing || (!existing.photo_url && player.photo_url))
      unique.set(key, player);
  }
  return Array.from(unique.values()).sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(
      `${b.first_name} ${b.last_name}`,
      "nl-BE",
    ),
  );
}

function isVisible(block: any, match: any) {
  if (block.configuration?.enabled === false) return false;
  if (block.configuration?.timed !== true) return true;
  if (!match?.match_date) return false;
  const target = `${match.match_date}T${(match.start_time || "00:00:00").slice(0, 8)}`;
  const summer = new Date(`${target}+02:00`),
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Brussels",
        hour: "2-digit",
        hour12: false,
      }).format(summer),
    ),
    wanted = Number((match.start_time || "00").slice(0, 2)),
    kick = summer.getTime() + (wanted - hour) * 3600000;
  return (
    Date.now() >=
      kick - (Number(block.configuration.hoursBefore) || 0) * 3600000 &&
    Date.now() <= kick + (Number(block.configuration.hoursAfter) || 0) * 3600000
  );
}
