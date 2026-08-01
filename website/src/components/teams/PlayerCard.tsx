import type { Player } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";
import Link from "next/link";
import { useI18n } from "@/i18n/client";

export function PlayerCard({ player, clipCount, onDelete }: { player: Player; clipCount: number; onDelete?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="group relative rounded-lg border border-border bg-cardAlt transition hover:border-accent hover:bg-cardHover">
      {onDelete && <button
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(); }}
        aria-label={t("team.removePlayer")}
        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded px-2 py-1 text-lg leading-none text-textMuted opacity-100 hover:bg-red-500/15 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
      >
        &times;
      </button>}
      <Link href={`/dashboard/teams/players/${player.id}`} className="flex min-h-16 items-center gap-3 rounded-lg px-3 py-2.5 pr-12 focus:outline-none focus:ring-2 focus:ring-accent">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-avatar text-sm font-bold text-accent">{player.initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-textCard">{getPlayerDisplayName(player)}</div>
          <div className="flex items-center gap-2">{player.position && <span className="truncate text-xs text-textMuted">{player.position}</span>}{player.is_goalkeeper && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">Doelman</span>}</div>
        </div>
        <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-accentDim px-2.5 py-1 text-xs font-semibold text-accent" title={t("team.taggedClips", { count: clipCount })}>
          <span className="grid h-4 w-4 place-items-center rounded-full border border-accent" aria-hidden="true">
            <span className="ml-0.5 block h-0 w-0 border-y-[3px] border-l-[5px] border-y-transparent border-l-accent" />
          </span>
          {clipCount}
        </span>
      </Link>
    </div>
  );
}
