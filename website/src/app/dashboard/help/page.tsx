"use client";

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
