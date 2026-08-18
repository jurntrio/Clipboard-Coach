"use client";

import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useI18n } from "@/i18n/client";

export default function HelpPage() {
  const { t } = useI18n();
  const topics = [
    { title: t("help.teamsTitle"), body: t("help.teamsBody") },
    { title: t("help.videoTitle"), body: t("help.videoBody") },
    { title: t("help.tagTitle"), body: t("help.tagBody") },
    { title: t("help.clipTitle"), body: t("help.clipBody") },
    { title: t("help.shareTitle"), body: t("help.shareBody") }
  ];
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <SectionHeader title={t("common.help")} artworkSrc="/branding/help.png" showHome={false} />

      <section className="mb-5 rounded-xl border border-accent/40 bg-card p-5">
        <p className="text-xs font-black uppercase tracking-[.16em] text-accent">Startgids voor trainers</p>
        <h2 className="mt-1 text-lg font-bold text-textBright">Trainingen plannen en wedstrijden importeren</h2>
        <p className="mt-2 text-sm leading-6 text-textSecondary">Bekijk opnieuw hoe je een reeks trainingen aanmaakt en een Foot24 iCal-link toevoegt. Op een niet-persoonlijk account opent de gids veilig in oefenmodus.</p>
        <Link href="/dashboard/help/startgids" className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 font-bold text-page">Tutorial opnieuw starten</Link>
      </section>

      <div className="flex flex-col gap-3">
        {topics.map((topic) => (
          <div key={topic.title} className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-textBright font-semibold mb-1">{topic.title}</h2>
            <p className="text-textSecondary text-sm">{topic.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
