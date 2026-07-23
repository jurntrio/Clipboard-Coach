import type { Player } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

export function PlayerCard({ player, clipCount, onDelete }: { player: Player; clipCount: number; onDelete: () => void }) {
  const { t } = useI18n();
  return (
    <div className="relative group bg-cardAlt border border-border rounded-lg text-center hover:border-accent hover:bg-cardHover transition">
      <button
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(); }}
        aria-label={t("team.removePlayer")}
        className="absolute z-10 top-1 right-1 text-textMuted hover:text-red-400 opacity-0 group-hover:opacity-100 text-sm leading-none"
      >
        &times;
      </button>
      <Link href={`/dashboard/teams/players/${player.id}`} className="flex flex-col items-center gap-1.5 rounded-lg px-2.5 pb-2.5 pt-3.5 focus:outline-none focus:ring-2 focus:ring-accent">
        <div className="w-10 h-10 rounded-full bg-avatar flex items-center justify-center text-accent font-bold text-sm">{player.initials}</div>
        <span className="text-textCard text-sm leading-tight break-words">{getPlayerDisplayName(player)}</span>
        <span className="text-textMuted text-xs">{t("team.taggedClips", { count: clipCount })}</span>
      </Link>
    </div>
  );
}
