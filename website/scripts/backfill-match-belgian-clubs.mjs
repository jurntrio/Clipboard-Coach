// One-time backfill: links existing matches to public.belgian_clubs by
// team_a_name / team_b_name, so ClubLogo can resolve a logo for matches that
// were imported before migration 0135 added team_a_belgian_club_id /
// team_b_belgian_club_id. Safe to re-run - it only ever updates rows where
// the relevant *_belgian_club_id is still null.
//
// Matching is exact-only (same normalization as resolveBelgianClubByName):
// a wrong club link is worse than no logo, so anything that doesn't match
// exactly is left alone and printed at the end for manual review via
// /dashboard/admin/club-matching.
//
// Usage (run from website/, after migration 0135 has been applied):
//   node --env-file=.env.local scripts/backfill-match-belgian-clubs.mjs

import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}. Run with: node --env-file=.env.local scripts/backfill-match-belgian-clubs.mjs`);
  return value;
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});

function normalizeClubName(value) {
  return value
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s._-]+[AB]\s*$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("nl")
    .replace(/[^a-z0-9]/g, "");
}

async function fetchAll(table, columns) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

async function buildNameIndex() {
  const [clubs, aliases, linkedMatches] = await Promise.all([
    fetchAll("belgian_clubs", "id, naam"),
    fetchAll("club_name_aliases", "alias, belgian_club_id"),
    fetchAll("matches", "team_a_name, team_a_belgian_club_id, team_b_name, team_b_belgian_club_id")
  ]);
  const index = new Map();
  for (const club of clubs) index.set(normalizeClubName(club.naam), club.id);
  const linkedIdsByName = new Map();
  for (const match of linkedMatches) {
    for (const [name, clubId] of [
      [match.team_a_name, match.team_a_belgian_club_id],
      [match.team_b_name, match.team_b_belgian_club_id]
    ]) {
      if (!name || !clubId) continue;
      const normalized = normalizeClubName(name);
      const ids = linkedIdsByName.get(normalized) ?? new Set();
      ids.add(clubId);
      linkedIdsByName.set(normalized, ids);
    }
  }
  for (const [name, ids] of linkedIdsByName) {
    if (ids.size === 1) index.set(name, [...ids][0]);
  }
  for (const alias of aliases) index.set(normalizeClubName(alias.alias), alias.belgian_club_id);
  return index;
}

async function backfillColumn(nameColumn, clubIdColumn, index) {
  const rows = await fetchAll("matches", `id, ${nameColumn}, ${clubIdColumn}`);
  const unresolved = rows.filter((row) => !row[clubIdColumn] && row[nameColumn]?.trim());

  const uniqueNames = [...new Set(unresolved.map((row) => row[nameColumn].trim()))];
  let matched = 0;
  const stillUnmatched = [];

  for (const name of uniqueNames) {
    const belgianClubId = index.get(normalizeClubName(name));
    if (!belgianClubId) {
      stillUnmatched.push(name);
      continue;
    }
    const { error } = await supabase
      .from("matches")
      .update({ [clubIdColumn]: belgianClubId })
      .eq(nameColumn, name)
      .is(clubIdColumn, null);
    if (error) throw new Error(`Update ${nameColumn}="${name}" mislukt: ${error.message}`);
    matched++;
  }

  return { uniqueNames: uniqueNames.length, matched, stillUnmatched };
}

async function main() {
  const index = await buildNameIndex();
  console.log(`Naamindex geladen: clubs + aliassen.`);

  const teamA = await backfillColumn("team_a_name", "team_a_belgian_club_id", index);
  const teamB = await backfillColumn("team_b_name", "team_b_belgian_club_id", index);

  console.log(`\nteam_a_name: ${teamA.matched}/${teamA.uniqueNames} unieke namen gekoppeld.`);
  console.log(`team_b_name: ${teamB.matched}/${teamB.uniqueNames} unieke namen gekoppeld.`);

  const allUnmatched = [...new Set([...teamA.stillUnmatched, ...teamB.stillUnmatched])].sort();
  if (allUnmatched.length) {
    console.log(`\n${allUnmatched.length} niet-gekoppelde naam/namen (review via /dashboard/admin/club-matching):`);
    for (const name of allUnmatched) console.log(`  - ${name}`);
  } else {
    console.log("\nGeen niet-gekoppelde namen over.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
