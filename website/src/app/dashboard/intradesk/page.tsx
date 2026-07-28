import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function IntradeskPage() {
  return <div className="mx-auto max-w-5xl p-4 sm:p-8">
    <SectionHeader title="Intradesk" subtitle="Persoonlijke trainingen en de bibliotheek van je club." artworkSrc="/branding/intradesk.png" />
    <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Image src="/branding/intradesk.png" alt="" width={140} height={140} className="mx-auto h-24 w-24 object-contain opacity-80" />
      <h2 className="mt-5 text-xl font-bold text-textBright">Intradesk wordt voorbereid</h2>
      <p className="mt-2 text-sm text-textMuted">De persoonlijke map, clubbibliotheek, leeftijdscategorieën en versiegeschiedenis komen hier.</p>
    </section>
  </div>;
}
