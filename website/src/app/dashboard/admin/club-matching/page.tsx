import { SectionHeader } from "@/components/ui/SectionHeader";
import { requireAdminOrViewer } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeClubName } from "@/lib/belgian-clubs/resolve-belgian-club-by-name";
import { ClubNameMatchReview } from "./ClubNameMatchReview";

async function fetchAll<T>(admin: ReturnType<typeof createAdminClient>, table: string, columns: string) {
  const pageSize = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await admin.from(table).select(columns).range(from, from + pageSize - 1);
    if (!data?.length) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return all;
}

export default async function ClubMatchingAdminPage() {
  const { isFullAdmin } = await requireAdminOrViewer();
  const admin = createAdminClient();

  const [teamARows, teamBRows, clubRows] = await Promise.all([
    fetchAll<{ team_a_name: string | null; team_a_belgian_club_id: string | null }>(
      admin, "matches", "team_a_name, team_a_belgian_club_id"
    ),
    fetchAll<{ team_b_name: string | null; team_b_belgian_club_id: string | null }>(
      admin, "matches", "team_b_name, team_b_belgian_club_id"
    ),
    fetchAll<{ id: string; stamnummer: number; naam: string }>(admin, "belgian_clubs", "id, stamnummer, naam")
  ]);

  // Grouped by normalized name, not literal text: "KSV. Oostkamp" and
  // "KSV. Oostkamp (1 A)" resolve to the same club, so they should only need
  // one confirmation, not one per literal variant.
  const groups = new Map<string, { variantCounts: Map<string, number> }>();
  function record(name: string | null) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const key = normalizeClubName(trimmed);
    if (!key) return;
    const group = groups.get(key) ?? { variantCounts: new Map<string, number>() };
    group.variantCounts.set(trimmed, (group.variantCounts.get(trimmed) ?? 0) + 1);
    groups.set(key, group);
  }
  for (const row of teamARows) if (!row.team_a_belgian_club_id) record(row.team_a_name);
  for (const row of teamBRows) if (!row.team_b_belgian_club_id) record(row.team_b_name);

  const unresolved = [...groups.values()]
    .map(({ variantCounts }) => {
      const variants = [...variantCounts.entries()].sort((a, b) => b[1] - a[1]);
      return {
        name: variants[0][0],
        count: variants.reduce((sum, [, count]) => sum + count, 0),
        variants: variants.map(([variant]) => variant)
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "nl-BE"));

  const clubs = [...clubRows].sort((a, b) => a.naam.localeCompare(b.naam, "nl-BE"));

  return (
    <div className="mx-auto max-w-5xl p-8">
      <SectionHeader
        title="Clubnaam-matching"
        subtitle="Namen uit wedstrijden die niet automatisch aan een Belgische club gekoppeld konden worden. Bevestig de juiste club om een alias te bewaren en meteen alle bestaande wedstrijden met deze naam te koppelen."
        artworkSrc="/branding/admin.png"
        backHref="/dashboard/admin"
      />
      <ClubNameMatchReview rows={unresolved} clubs={clubs} readOnly={!isFullAdmin} />
    </div>
  );
}
