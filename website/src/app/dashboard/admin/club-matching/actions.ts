"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateBelgianClubNameIndex, resolveBelgianClubByName } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";
import { normalizeClubName } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";

async function backfillStillUnresolvedMatches(admin: ReturnType<typeof createAdminClient>) {
  for (const [nameColumn, clubIdColumn] of [
    ["team_a_name", "team_a_belgian_club_id"],
    ["team_b_name", "team_b_belgian_club_id"]
  ] as const) {
    const { data } = await admin.from("matches").select(`id, ${nameColumn}`).is(clubIdColumn, null);
    const rows = (data ?? []) as Record<string, string | null>[];
    for (const row of rows) {
      const belgianClubId = await resolveBelgianClubByName(row[nameColumn]);
      if (!belgianClubId) continue;
      await admin.from("matches").update({ [clubIdColumn]: belgianClubId }).eq("id", row.id as string);
    }
  }
}

// Confirms that a literal team/club name (as it appears on matches) refers
// to a given Belgian club: saves it as an alias for future imports, then
// re-resolves every still-unlinked match. That catches not just an exact
// literal match but every other variant that normalizes the same way (e.g.
// "KSV. Oostkamp" and "KSV. Oostkamp (1 A)"), not only the confirmed string.
export async function confirmClubNameMatch(name: string, belgianClubId: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed || !belgianClubId) throw new Error("Naam en club zijn verplicht.");

  const admin = createAdminClient();

  const { error: aliasError } = await admin
    .from("club_name_aliases")
    .upsert({ alias: trimmed, belgian_club_id: belgianClubId }, { onConflict: "alias" });
  if (aliasError) throw new Error(aliasError.message);

  invalidateBelgianClubNameIndex();
  await backfillStillUnresolvedMatches(admin);

  revalidatePath("/dashboard/admin/club-matching");
}

export async function changeClubNameMatch(name: string, belgianClubId: string | null) {
  await requireAdmin();
  const trimmed = name.trim();
  const normalized = normalizeClubName(trimmed);
  if (!trimmed || !normalized) throw new Error("Clubnaam is verplicht.");

  const admin = createAdminClient();
  const [{ data: aliases, error: aliasReadError }, { data: matches, error: matchReadError }] = await Promise.all([
    admin.from("club_name_aliases").select("alias"),
    admin.from("matches").select("id, team_a_name, team_b_name")
  ]);
  if (aliasReadError || matchReadError) throw new Error(aliasReadError?.message ?? matchReadError?.message);

  const matchingAliases = (aliases ?? []).filter(row => normalizeClubName(row.alias) === normalized).map(row => row.alias);
  if (belgianClubId) {
    const { error } = await admin.from("club_name_aliases")
      .upsert({ alias: trimmed, belgian_club_id: belgianClubId }, { onConflict: "alias" });
    if (error) throw new Error(error.message);
    for (const alias of matchingAliases.filter(alias => alias !== trimmed)) {
      const { error: updateError } = await admin.from("club_name_aliases").update({ belgian_club_id: belgianClubId }).eq("alias", alias);
      if (updateError) throw new Error(updateError.message);
    }
  } else if (matchingAliases.length) {
    const { error } = await admin.from("club_name_aliases").delete().in("alias", matchingAliases);
    if (error) throw new Error(error.message);
  }

  let updated = 0;
  for (const match of matches ?? []) {
    const changes: Record<string, string | null> = {};
    if (normalizeClubName(match.team_a_name) === normalized) changes.team_a_belgian_club_id = belgianClubId;
    if (normalizeClubName(match.team_b_name) === normalized) changes.team_b_belgian_club_id = belgianClubId;
    if (!Object.keys(changes).length) continue;
    const { error } = await admin.from("matches").update(changes).eq("id", match.id);
    if (error) throw new Error(error.message);
    updated += 1;
  }

  invalidateBelgianClubNameIndex();
  revalidatePath("/dashboard/admin/club-matching");
  return { updated };
}
