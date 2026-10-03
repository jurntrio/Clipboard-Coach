import { pageTitle } from "@/lib/page-metadata";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ClipProfilesTable } from "@/components/settings/ClipProfilesTable";

export default function ClipProfilesPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/dashboard/settings" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">← Instellingen</Link>
      <SectionHeader title="Clip Profiles" artworkSrc="/branding/settings.webp" showHome={false} />
      <section className="rounded-2xl border border-border bg-cardDeep p-5">
        <h2 className="text-lg font-semibold text-textBright">Standaard clipduur per tag</h2>
        <p className="mb-5 mt-1 max-w-3xl text-sm text-textMuted">Gebruik negatieve of positieve seconden ten opzichte van het exacte tagmoment. Een Goal met start −10 en einde +3 maakt bijvoorbeeld op 35:42 automatisch de clip 35:32–35:45. Je kunt de tijden van elke gemaakte tag nadien nog aanpassen.</p>
        <ClipProfilesTable />
      </section>
    </div>
  );
}

export const generateMetadata = pageTitle("page.clipProfiles");
