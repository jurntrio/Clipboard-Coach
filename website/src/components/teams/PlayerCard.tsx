import type { Player } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";

export function PlayerCard({ player, clipCount, onDelete }: { player: Player; clipCount: number; onDelete: () => void }) {
  return (
    <div className="relative group flex flex-col items-center gap-1.5 bg-cardAlt border border-border rounded-lg pt-3.5 px-2.5 pb-2.5 text-center hover:border-accent hover:bg-cardHover transition">
      <button
        onClick={onDelete}
        aria-label="Remove player"
        className="absolute top-1 right-1 text-textMuted hover:text-red-400 opacity-0 group-hover:opacity-100 text-sm leading-none"
      >
        &times;
      </button>
      <div className="w-10 h-10 rounded-full bg-avatar flex items-center justify-center text-accent font-bold text-sm">
        {player.initials}
      </div>
      <span className="text-textCard text-sm leading-tight break-words">{getPlayerDisplayName(player)}</span>
      <span className="text-textMuted text-xs">
        {clipCount} clip{clipCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}
