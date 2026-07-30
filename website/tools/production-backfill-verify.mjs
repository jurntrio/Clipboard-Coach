import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function all(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

const [clubPlayers, people, clubPeople, memberships, seasons, players, accounts, roles, trainers, runs] =
  await Promise.all([
    all("club_players", "id,club_person_id"),
    all("people", "id,status"),
    all("club_people", "id,person_id,club_id,status"),
    all("player_team_memberships", "id,club_player_id,season_id,status,membership_type,team_id"),
    all("club_seasons", "id,club_id"),
    all("players", "id,membership_id"),
    all("person_accounts", "person_id,profile_id,status,revoked_at"),
    all("club_role_assignments", "id,club_person_id,status"),
    all("club_trainers", "id,club_person_id,profile_id,invitation_status"),
    all("person_backfill_runs", "id,status,preview_hash,completed_at")
  ]);

const clubPlayerIds = new Set(clubPlayers.map((row) => row.id));
const clubPersonIds = new Set(clubPeople.map((row) => row.id));
const personIds = new Set(people.map((row) => row.id));
const membershipIds = new Set(memberships.map((row) => row.id));
const seasonIds = new Set(seasons.map((row) => row.id));
const activeAccounts = accounts.filter((row) => row.status === "active" && !row.revoked_at);
const latestRun = runs.filter((row) => row.status === "completed")
  .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];

const verification = {
  counts: {
    club_players: clubPlayers.length,
    linked_club_players: clubPlayers.filter((row) => row.club_person_id).length,
    people: people.length,
    club_people: clubPeople.length,
    memberships: memberships.length,
    seasons_total: seasons.length,
    seasons_referenced_by_memberships: new Set(memberships.map((row) => row.season_id).filter(Boolean)).size,
    operational_players_total: players.length,
    operational_players_with_membership: players.filter((row) => row.membership_id).length,
    active_person_accounts: activeAccounts.length,
    active_roles: roles.filter((row) => row.status === "active").length,
    club_trainers: trainers.length
  },
  integrity: {
    club_players_with_missing_club_person: clubPlayers.filter((row) => row.club_person_id && !clubPersonIds.has(row.club_person_id)).length,
    club_people_with_missing_person: clubPeople.filter((row) => !personIds.has(row.person_id)).length,
    memberships_with_missing_club_player: memberships.filter((row) => !clubPlayerIds.has(row.club_player_id)).length,
    memberships_with_missing_season: memberships.filter((row) => row.season_id && !seasonIds.has(row.season_id)).length,
    players_with_missing_membership: players.filter((row) => row.membership_id && !membershipIds.has(row.membership_id)).length,
    duplicate_active_person_accounts: activeAccounts.length - new Set(activeAccounts.map((row) => row.person_id)).size,
    duplicate_active_profile_accounts: activeAccounts.length - new Set(activeAccounts.map((row) => row.profile_id)).size
  },
  latest_run: latestRun,
  dylan: {
    club_player: clubPlayers.find((row) => row.id === "a65df2b0-c02d-4d74-b9a1-19088be3505a"),
    membership: memberships.find((row) => row.id === "29eac58b-8fc3-46ce-8eb6-19f4650971e5")
  }
};

const expected = verification.counts.club_players === 28
  && verification.counts.linked_club_players === 28
  && verification.counts.people === 28
  && verification.counts.club_people === 28
  && verification.counts.memberships === 54
  && verification.counts.seasons_referenced_by_memberships === 1
  && verification.counts.operational_players_with_membership === 54
  && verification.latest_run?.preview_hash === "a2dab735cd3ee0bd4ae055a710503fc4"
  && Object.values(verification.integrity).every((value) => value === 0)
  && verification.dylan.club_player?.club_person_id
  && verification.dylan.membership?.status === "active"
  && verification.dylan.membership?.membership_type === "primary";

if (!expected) throw new Error(`Production integrity failed: ${JSON.stringify(verification)}`);
console.log(JSON.stringify(verification, null, 2));
