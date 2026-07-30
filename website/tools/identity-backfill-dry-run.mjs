import fs from "node:fs";
import process from "node:process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { Client, types } = require(
  "C:/Users/jurnt/AppData/Local/Temp/clipboard-coach-snapshot-tools/node_modules/pg"
);
types.setTypeParser(1082, (value) => value);

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

async function fetchAll(client, table, select = "*", filter) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    let query = client.from(table).select(select).range(from, from + 499);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

function values(row, columns) {
  return columns.map((column) => row[column] ?? null);
}

async function insertRows(db, table, columns, rows) {
  for (const row of rows) {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await db.query(
      `insert into public.${table} (${columns.join(", ")}) values (${placeholders})`,
      values(row, columns)
    );
  }
}

const env = readEnv(new URL("../.env.local", import.meta.url));
const remoteUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const remoteKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!remoteUrl || !remoteKey) throw new Error("Remote Supabase configuration is missing.");
if (new URL(remoteUrl).hostname === "127.0.0.1") throw new Error("Expected a remote source.");

const remote = createClient(remoteUrl, remoteKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const clubPlayers = await fetchAll(remote, "club_players",
  "id,club_id,first_name,last_name,date_of_birth,email,phone,phone_2,phone_2_name,phone_3,phone_3_name,address,postal_code,city,created_at,updated_at");
const clubIds = [...new Set(clubPlayers.map((row) => row.club_id))];
const clubs = clubIds.length
  ? await fetchAll(remote, "clubs", "id,name,normalized_name,status,created_at,updated_at",
      (query) => query.in("id", clubIds))
  : [];
const seasons = clubIds.length
  ? await fetchAll(remote, "club_seasons", "id,club_id,name,starts_on,ends_on,is_active,created_at",
      (query) => query.in("club_id", clubIds))
  : [];
const memberships = clubPlayers.length
  ? await fetchAll(remote, "player_team_memberships",
      "id,club_player_id,team_id,season_id,membership_type,status,joined_at,left_at,valid_from,valid_until,created_at,updated_at",
      (query) => query.in("club_player_id", clubPlayers.map((row) => row.id)))
  : [];
const teamIds = [...new Set(memberships.map((row) => row.team_id))];
const teams = teamIds.length
  ? await fetchAll(remote, "teams", "id,club_team_id,name,age_group,club_name,created_at,updated_at",
      (query) => query.in("id", teamIds))
  : [];
const clubTeamIds = [...new Set(teams.map((row) => row.club_team_id).filter(Boolean))];
const clubTeams = clubTeamIds.length
  ? await fetchAll(remote, "club_teams",
      "id,club_id,name,normalized_name,status,created_at,updated_at",
      (query) => query.in("id", clubTeamIds))
  : [];
const operationalPlayers = memberships.length
  ? await fetchAll(remote, "players",
      "id,team_id,first_name,last_name,position,email,date_of_birth,phone_numbers,jersey_number,role,membership_id,created_at",
      (query) => query.in("membership_id", memberships.map((row) => row.id)))
  : [];

const db = new Client({
  host: "127.0.0.1", port: 54322, database: "postgres", user: "postgres", password: "postgres"
});
await db.connect();

try {
  await db.query("begin");
  await db.query(`
    truncate public.clubs, public.club_teams, public.teams, public.club_seasons,
      public.club_players, public.player_team_memberships, public.players,
      public.people, public.club_people, public.person_accounts,
      public.club_role_assignments, public.person_backfill_runs,
      public.person_backfill_actions, public.person_migration_issues,
      public.person_claim_reviews, public.identity_audit_log
    restart identity cascade
  `);

  await insertRows(db, "clubs",
    ["id", "name", "normalized_name", "status", "created_at", "updated_at"], clubs);
  await insertRows(db, "club_teams",
    ["id", "club_id", "name", "normalized_name", "status", "created_at", "updated_at"], clubTeams);
  await insertRows(db, "teams",
    ["id", "club_team_id", "name", "age_group", "club_name", "created_at", "updated_at"], teams);
  await insertRows(db, "club_seasons",
    ["id", "club_id", "name", "starts_on", "ends_on", "is_active", "created_at"], seasons);
  await insertRows(db, "club_players", [
    "id", "club_id", "first_name", "last_name", "date_of_birth", "email", "phone",
    "phone_2", "phone_2_name", "phone_3", "phone_3_name", "address", "postal_code",
    "city", "created_at", "updated_at"
  ], clubPlayers);
  await insertRows(db, "player_team_memberships", [
    "id", "club_player_id", "team_id", "season_id", "membership_type", "status",
    "joined_at", "left_at", "valid_from", "valid_until", "created_at", "updated_at"
  ], memberships);
  await insertRows(db, "players", [
    "id", "team_id", "first_name", "last_name", "position", "email", "date_of_birth",
    "phone_numbers", "jersey_number", "role", "membership_id", "created_at"
  ], operationalPlayers);

  const summary = (await db.query("select public.club_people_backfill_summary() as report")).rows[0].report;
  const preview = (await db.query(`
    select club_player_id, club_id, first_name, last_name, date_of_birth,
      existing_club_person_id, existing_person_id, candidate_person_ids,
      candidate_count, classification, certainty, missing_identifiers,
      possible_duplicate, proposed_mutation
    from public.preview_club_people_backfill()
  `)).rows;
  const exactMutations = preview
    .filter((row) => row.proposed_mutation !== "none")
    .map((row) => ({
      club_player_id: row.club_player_id,
      action: row.proposed_mutation,
      preserves_club_player_id: true
    }));

  const result = {
    source: new URL(remoteUrl).hostname,
    snapshot: {
      clubs: clubs.length,
      club_teams: clubTeams.length,
      teams: teams.length,
      club_seasons: seasons.length,
      club_players: clubPlayers.length,
      memberships: memberships.length,
      operational_players: operationalPlayers.length
    },
    summary,
    uncertain_cases: preview.filter((row) => row.certainty === "requires_review"),
    proposed_new_people: preview.filter((row) => row.classification === "create_new_person"),
    proposed_existing_links: preview.filter((row) => row.classification === "review_existing_candidate"),
    exact_mutations: exactMutations,
    dylan: preview
      .filter((row) => row.first_name === "Dylan" && row.last_name === "Bauwens")
      .map((row) => ({
        ...row,
        memberships: memberships
          .filter((membership) => membership.club_player_id === row.club_player_id)
          .map((membership) => {
            const team = teams.find((item) => item.id === membership.team_id);
            const clubTeam = clubTeams.find((item) => item.id === team?.club_team_id);
            return {
              membership_id: membership.id,
              membership_type: membership.membership_type,
              status: membership.status,
              team_id: membership.team_id,
              team_name: clubTeam?.name ?? team?.name ?? null,
              season_id: membership.season_id
            };
          })
      })),
    all_rows: preview
  };
  if (process.argv.includes("--compact")) {
    process.stdout.write(JSON.stringify({
      source: result.source,
      snapshot: result.snapshot,
      summary: result.summary,
      uncertain_cases: result.uncertain_cases,
      proposed_existing_links: result.proposed_existing_links,
      dylan: result.dylan,
      proposed_new_people: result.proposed_new_people.map((row) => ({
        club_player_id: row.club_player_id,
        name: `${row.first_name} ${row.last_name}`,
        date_of_birth: row.date_of_birth,
        mutation: row.proposed_mutation
      }))
    }, null, 2));
  } else {
    process.stdout.write(JSON.stringify(result, null, 2));
  }
} finally {
  await db.query("rollback");
  await db.end();
}
