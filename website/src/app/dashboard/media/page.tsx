import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";

const mediaSections = [
  { title: "Schermen & apparaten", description: "Maak fysieke schermen aan en koppel later elk scherm aan de juiste N100-speler.", symbol: "▣" },
  { title: "Streams", description: "Beheer welke automatische inhoudsstroom op één of meerdere schermen wordt afgespeeld.", symbol: "▶" },
  { title: "Planning", description: "Plan tijdelijke programma's en laat schermen automatisch wisselen voor wedstrijden en evenementen.", symbol: "◷" },
  { title: "Sponsors", description: "Beheer club-, jeugd-, team- en evenementensponsors en hun zichtbaarheid.", symbol: "★" },
  { title: "Nieuws", description: "Maak berichten die later op ClubTV, website of andere clubkanalen kunnen verschijnen.", symbol: "N" },
  { title: "Evenementen", description: "Bundel media voor eetfestijnen, tornooien, recepties en andere clubactiviteiten.", symbol: "E" },
  { title: "Livestreams", description: "Koppel later livestreams aan wedstrijden, schermen en automatische programma's.", symbol: "●" },
  { title: "Campagnes", description: "Groepeer sponsors, nieuws, beelden en streams rond één campagne.", symbol: "C" },
  { title: "Statistieken", description: "Bekijk later bereik, afspeelmomenten en de zichtbaarheid van sponsors.", symbol: "↗" }
];

export default function MediaPage() {
  return <main className="mx-auto max-w-7xl p-4 sm:p-8">
    <SectionHeader title="Media" subtitle="De centrale plek voor ClubTV, schermen, streams, sponsoring en communicatie." artworkSrc="/branding/media.svg" showHome={false} />
    <section className="mb-6 overflow-hidden rounded-2xl border border-accent/30 bg-card">
      <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
        <Image src="/branding/media.svg" alt="" width={84} height={84} className="h-20 w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Eerste opbouw</p>
          <h2 className="mt-1 text-2xl font-black text-textBright">Media & ClubTV</h2>
          <p className="mt-2 max-w-3xl text-sm text-textSecondary">Deze pagina vormt de afzonderlijke basis voor het toekomstige mediabeheer. De onderdelen hieronder zijn voorlopig een overzicht en bevatten nog geen actieve scherm- of streambesturing.</p>
        </div>
      </div>
    </section>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {mediaSections.map(section => <section key={section.title} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-xl font-black text-accent">{section.symbol}</span>
          <div><h2 className="font-bold text-textBright">{section.title}</h2><p className="mt-1 text-sm leading-6 text-textMuted">{section.description}</p></div>
        </div>
        <span className="mt-4 inline-flex rounded-full border border-borderButton px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-textMuted">Binnenkort</span>
      </section>)}
    </div>
  </main>;
}
