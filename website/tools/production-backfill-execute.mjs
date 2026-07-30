import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_HASH = "a2dab735cd3ee0bd4ae055a710503fc4";
const DYLAN_CLUB_PLAYER_ID = "a65df2b0-c02d-4d74-b9a1-19088be3505a";
const DYLAN_MEMBERSHIP_ID = "29eac58b-8fc3-46ce-8eb6-19f4650971e5";

function readEnv(path) {
  return Object.fromEntries(
    fs.readFileSync(path, "utf8").split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const splitAt = line.indexOf("=");
        return [line.slice(0, splitAt), line.slice(splitAt + 1).replace(/^"|"$/g, "")];
      })
  );
}

const env = readEnv(new URL("../.env.local", import.meta.url));
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: before, error: beforeError } = await supabase.rpc("club_people_backfill_summary");
if (beforeError) throw beforeError;
if (before.preview_hash !== EXPECTED_HASH) {
  throw new Error(`Production preview changed: ${before.preview_hash}`);
}
if (Number(before.uncertain_links) !== 0 || Number(before.new_people_proposed) !== 28) {
  throw new Error(`Production preview is not approved: ${JSON.stringify(before)}`);
}

const { data: runId, error: executeError } = await supabase.rpc(
  "execute_club_people_backfill",
  { expected_preview_hash: EXPECTED_HASH }
);
if (executeError) throw executeError;

const [
  peopleResult,
  clubPeopleResult,
  linkedPlayersResult,
  membershipsResult,
  seasonsResult,
  operationalPlayersResult,
  accountsResult,
  dylanResult,
  dylanMembershipResult,
  runResult
] = await Promise.all([
  supabase.from("people").select("*", { count: "exact", head: true }),
  supabase.from("club_people").select("*", { count: "exact", head: true }),
  supabase.from("club_players").select("*", { count: "exact", head: true }).not("club_person_id", "is", null),
  supabase.from("player_team_memberships").select("*", { count: "exact", head: true }),
  supabase.from("club_seasons").select("*", { count: "exact", head: true }),
  supabase.from("players").select("*", { count: "exact", head: true }).not("membership_id", "is", null),
  supabase.from("person_accounts").select("person_id,profile_id,status"),
  supabase.from("club_players").select("id,club_person_id,first_name,last_name,date_of_birth")
    .eq("id", DYLAN_CLUB_PLAYER_ID).single(),
  supabase.from("player_team_memberships").select("id,club_player_id,team_id,season_id,membership_type,status")
    .eq("id", DYLAN_MEMBERSHIP_ID).single(),
  supabase.from("person_backfill_runs").select("id,status,preview_hash,summary,completed_at")
    .eq("id", runId).single()
]);

const results = [
  peopleResult, clubPeopleResult, linkedPlayersResult, membershipsResult,
  seasonsResult, operationalPlayersResult, accountsResult, dylanResult,
  dylanMembershipResult, runResult
];
const failed = results.find((result) => result.error);
if (failed) throw failed.error;

const activeAccounts = accountsResult.data.filter((row) => row.status === "active");
const duplicatePeople = activeAccounts.length - new Set(activeAccounts.map((row) => row.person_id)).size;
const duplicateProfiles = activeAccounts.length - new Set(activeAccounts.map((row) => row.profile_id)).size;

const verification = {
  run_id: runId,
  run: runResult.data,
  counts: {
    people: peopleResult.count,
    club_people: clubPeopleResult.count,
    linked_club_players: linkedPlayersResult.count,
    memberships: membershipsResult.count,
    seasons: seasonsResult.count,
    operational_players_with_membership: operationalPlayersResult.count,
    active_person_accounts: activeAccounts.length
  },
  integrity: {
    duplicate_active_person_accounts: duplicatePeople,
    duplicate_active_profile_accounts: duplicateProfiles,
    all_expected_club_players_linked: linkedPlayersResult.count === 28,
    memberships_preserved: membershipsResult.count === 54,
    seasons_preserved: seasonsResult.count === 1,
    operational_players_preserved: operationalPlayersResult.count === 54
  },
  dylan: {
    club_player: dylanResult.data,
    membership: dylanMembershipResult.data
  }
};

if (!Object.values(verification.integrity).every((value) => value === true || value === 0)) {
  throw new Error(`Post-backfill integrity failed: ${JSON.stringify(verification)}`);
}

console.log(JSON.stringify(verification, null, 2));
