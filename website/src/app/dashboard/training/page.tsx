import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getClubContext } from "@/lib/auth/active-club";
import { createClient } from "@/lib/supabase/server";

export default async function TrainingPage() {
  const context = await getClubContext();
  const supabase = createClient();
  const { data: intradeskEntitlement } = context.activeClubId
    ? await supabase.from("club_module_entitlements").select("club_id").eq("club_id", context.activeClubId).eq("module_key", "intradesk").eq("enabled", true).maybeSingle()
    : { data: { club_id: "personal" } };
  return <div className="mx-auto max-w-5xl p-4 sm:p-8">
    <SectionHeader title="Training" subtitle="Plan trainingen, houd aanwezigheden bij en maak nieuwe trainingsplannen." artworkSrc="/branding/training.png" />
    <section className="rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
      <Image src="/branding/training.png" alt="" width={150} height={150} className="mx-auto h-28 w-28 object-contain" />
      <h2 className="mt-5 text-2xl font-bold text-textBright">Trainingen</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-textSecondary">De trainingslijst en aanwezigheden worden hier in een volgende stap toegevoegd.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard/training/new" className="inline-flex rounded-lg bg-accent px-5 py-3 text-sm font-black text-page hover:brightness-110">Maak nieuwe training aan</Link>
        {intradeskEntitlement && <Link href="/dashboard/intradesk" className="inline-flex rounded-lg border border-borderButton px-5 py-3 text-sm font-bold text-textPrimary hover:border-accent hover:text-accent">Open Intradesk</Link>}
      </div>
    </section>
  </div>;
}
