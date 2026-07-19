import type { Player } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";

export function ActivePlayerSelector({
  players,
  selected,
  onChange
}: {
  players: Player[];
  selected: string[];
  onChange: (playerIds: string[]) => void;
}) {
  function toggle(playerId: string) {
    onChange(selected.includes(playerId) ? selected.filter((id) => id !== playerId) : [...selected, playerId]);
  }

  if (players.length === 0) {
    return <p className="text-textMuted text-sm">No players on this team yet.</p>;
  }

  return (
    <div>
      <p className="text-textMuted text-xs mb-2">Active players</p>
      <div className="flex flex-wrap gap-2">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => toggle(player.id)}
            className={`px-2 py-1 rounded text-xs ${
              selected.includes(player.id) ? "bg-accent text-page" : "bg-button text-textSecondary"
            }`}
          >
            {getPlayerDisplayName(player)}
          </button>
        ))}
      </div>
    </div>
  );
}
