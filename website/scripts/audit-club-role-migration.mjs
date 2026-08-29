import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.from("club_role_migration_audit")
  .select("club_id,profile_id,email,full_name,legacy_role,legacy_function_role,legacy_team_scope,club_person_id,canonical_role,canonical_team_scope,action_required")
  .order("email");
if (error) {
  console.error(error.message);
  process.exit(1);
}

const rows = data ?? [];
function expectedRole(row) {
  if (["club_admin", "club_admin_viewer"].includes(row.legacy_role)) return row.legacy_role;
  if (row.legacy_role === "analyst" && [null, "trainer", "video_analyst"].includes(row.legacy_function_role)) return "video_analyst";
  if ((row.legacy_function_role || row.legacy_role) === "coach") return "trainer";
  if ((row.legacy_function_role || row.legacy_role) === "assistant_coach") return "assistant_trainer";
  return row.legacy_function_role || row.legacy_role;
}
const auditedRows = rows.map((row) => ({
  ...row,
  effective_action: row.action_required === "unchanged" && row.canonical_role !== expectedRole(row)
    ? "role_differs" : row.action_required
}));
console.table(auditedRows.map((row) => ({
  persoon: row.full_name || row.email,
  legacy_technisch: row.legacy_role,
  legacy_functie: row.legacy_function_role || "—",
  nieuw: row.canonical_role || "—",
  teamscope_oud: row.legacy_team_scope,
  teamscope_nieuw: row.canonical_team_scope || "—",
  actie: row.effective_action
})));

const changed = auditedRows.filter((row) => row.effective_action !== "unchanged");
console.log(`\n${rows.length} personen gecontroleerd; ${changed.length} vereisen controle.`);
if (changed.length) process.exitCode = 2;
