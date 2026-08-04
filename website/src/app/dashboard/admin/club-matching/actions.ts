"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateBelgianClubNameIndex, resolveBelgianClubByName } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";

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
