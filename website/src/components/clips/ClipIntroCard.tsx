"use client";

import Image from "next/image";
import type { ClipIntro, IntroMatch } from "@/lib/clip-intro";

export function ClipIntroCard({ settings, match }: { settings: ClipIntro; match: IntroMatch }) {
  if (settings.mode === "upload") return <div className="flex aspect-video w-full items-center justify-center bg-black">
    {settings.imageUrl ? <Image src={settings.imageUrl} alt="Promotioneel introbeeld" width={1920} height={1080} unoptimized className="h-full max-h-full w-full object-contain" /> : <p className="text-white/60">Upload een afbeelding</p>}
  </div>;
  return <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden bg-[#081d15] p-4 text-center text-white sm:p-6">
    <div className="flex w-full items-center justify-center gap-3 sm:gap-6">
      {[{ name: match.teamA, logo: match.logoA }, { name: match.teamB, logo: match.logoB }].map((team, index) => <div key={index} className="contents">
        {index === 1 && <strong className="shrink-0 text-xl sm:text-3xl">{settings.showScore ? settings.score || match.score || "–" : "–"}</strong>}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          {team.logo && <Image src={team.logo} alt={`Logo ${team.name}`} width={128} height={128} unoptimized className="h-14 w-14 object-contain sm:h-20 sm:w-20" />}
          <span className="text-balance text-sm font-bold sm:text-xl">{team.name}</span>
        </div>
      </div>)}
    </div>
    {settings.mode === "sponsor" && <div className="flex max-w-full items-center justify-center gap-3 border-t border-white/20 pt-3">
      {settings.sponsorLogoUrl && <Image src={settings.sponsorLogoUrl} alt={settings.sponsorName || settings.sponsorLabel} width={180} height={90} unoptimized className="h-12 max-w-32 object-contain sm:h-16" />}
      <div><p className="text-xs text-white/70">{settings.sponsorLabel}</p><p className="text-sm font-bold sm:text-lg">{settings.sponsorName}</p></div>
    </div>}
  </div>;
}
