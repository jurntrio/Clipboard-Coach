import { SectionHeader } from "@/components/ui/SectionHeader";
import { requireAdminOrViewer } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicUrl } from "@/lib/r2/upload";
import { BelgianClubLogoManager } from "./BelgianClubLogoManager";

async function fetchAllBelgianClubs(admin: ReturnType<typeof createAdminClient>) {
  const pageSize = 1000;
  const all: { stamnummer: number; naam: string; small_logo_path: string | null; large_logo_path: string | null }[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await admin
      .from("belgian_clubs")
      .select("stamnummer, naam, small_logo_path, large_logo_path")
      .order("naam")
      .range(from, from + pageSize - 1);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

export default async function BelgianClubsAdminPage() {
  const { isFullAdmin } = await requireAdminOrViewer();
  const admin = createAdminClient();
  const data = await fetchAllBelgianClubs(admin);

  const rows = (data ?? []).map((club) => ({
    stamnummer: club.stamnummer as number,
    naam: club.naam as string,
    smallLogoUrl: club.small_logo_path ? getPublicUrl(club.small_logo_path as string) : null,
    largeLogoUrl: club.large_logo_path ? getPublicUrl(club.large_logo_path as string) : null
  }));

  return (
    <div className="mx-auto max-w-6xl p-8">
      <SectionHeader
        title="Belgische clublogo's"
        subtitle="Centrale referentielijst van alle Belgische clubs op stamnummer. Small logo's komen uit de bulk-import; large logo's upload je hier."
        artworkSrc="/branding/admin.webp"
        backHref="/dashboard/admin"
      />
      <BelgianClubLogoManager rows={rows} readOnly={!isFullAdmin} />
    </div>
  );
}
