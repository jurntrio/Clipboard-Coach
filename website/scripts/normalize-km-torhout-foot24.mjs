import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const normalize = value => value.replace(/\([^)]*\)/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl").replace(/[^a-z0-9]/g, "");

const { data: club, error: clubError } = await supabase.from("clubs").select("id").eq("rbfa_registration_number", 822).maybeSingle();
if (clubError || !club) throw clubError ?? new Error("KM Torhout (00822) niet gevonden.");

const [{ data: firstClubs, error: firstClubsError }, { data: remainingClubs, error: remainingClubsError }] = await Promise.all([
  supabase.from("belgian_clubs").select("id, naam, stamnummer").range(0, 999),
  supabase.from("belgian_clubs").select("id, naam, stamnummer").range(1000, 1999)
]);
if (firstClubsError || remainingClubsError) throw firstClubsError ?? remainingClubsError;
const canonicalClubs = [...firstClubs, ...remainingClubs];
const torhout = canonicalClubs.find(item => item.stamnummer === 822);
const oudenaarde = canonicalClubs.find(item => item.stamnummer === 81);
if (!torhout || !oudenaarde) throw new Error("Canonieke clubrecords ontbreken.");

const { error: aliasError } = await supabase.from("club_name_aliases").update({ belgian_club_id: oudenaarde.id }).ilike("alias", "KSV. OUDENAARDE");
if (aliasError) throw aliasError;
const { data: aliases, error: aliasesError } = await supabase.from("club_name_aliases").select("alias, belgian_club_id");
if (aliasesError) throw aliasesError;
const clubIndex = new Map(canonicalClubs.map(item => [normalize(item.naam), item.id]));
for (const alias of aliases) clubIndex.set(normalize(alias.alias), alias.belgian_club_id);

const { data: clubTeams, error: teamsError } = await supabase.from("club_teams").select("id, name, teams(id)").eq("club_id", club.id);
if (teamsError) throw teamsError;
const teamsById = new Map(clubTeams.map(team => [team.id, team]));
const { data: matches, error: matchesError } = await supabase.from("matches").select("id, club_team_id, team_a_name, team_b_name, is_home_match, score_a, score_b").eq("club_id", club.id).eq("external_source", "foot24");
if (matchesError) throw matchesError;

let updated = 0;
for (const match of matches) {
  const team = teamsById.get(match.club_team_id);
  const operational = Array.isArray(team?.teams) ? team.teams[0] : team?.teams;
  if (!team || !operational?.id) continue;
  const alreadyCanonical = match.team_a_name === team.name;
  const opponent = alreadyCanonical ? match.team_b_name : (match.is_home_match ? match.team_b_name : match.team_a_name);
  const payload = {
    team_a_id: operational.id,
    team_a_name: team.name,
    team_a_belgian_club_id: torhout.id,
    team_b_id: null,
    team_b_name: opponent,
    team_b_belgian_club_id: clubIndex.get(normalize(opponent)) ?? null,
    score_a: alreadyCanonical || match.is_home_match ? match.score_a : match.score_b,
    score_b: alreadyCanonical || match.is_home_match ? match.score_b : match.score_a
  };
  const { error } = await supabase.from("matches").update(payload).eq("id", match.id);
  if (error) throw error;
  updated += 1;
}

// These three legacy rows were imported with the short own label (U13A) on
// side A while is_home_match was false. Preserve their known feed opponents
// after canonicalising the own side to IP U13 Groen.
const recoveredOpponents = new Map([
  ["e8a6ba45-3e76-404f-91d9-fe383fc79663", "RACING CLUB GENT (U13 A)"],
  ["cbbad5a3-fc33-4aea-8027-cf87403e5ac4", "KSV. OUDENAARDE (U13 A)"],
  ["f8d75980-8125-4199-b197-3fca76192414", "K. RACING WAREGEM (U13 A)"]
]);
for (const [id, opponent] of recoveredOpponents) {
  const { error } = await supabase.from("matches").update({
    team_b_name: opponent,
    team_b_belgian_club_id: clubIndex.get(normalize(opponent)) ?? null
  }).eq("id", id).eq("club_id", club.id);
  if (error) throw error;
}

console.log(JSON.stringify({ updated, oudenaardeAlias: oudenaarde.id }, null, 2));
