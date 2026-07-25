import type { Player } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

export function ActivePlayerSelector({
  players,
  selected,
  onChange
}: {
  players: Player[];
  selected: string[];
  onChange: (playerIds: string[]) => void;
}) {
  const { t } = useI18n();
  function toggle(playerId: string) {
    onChange(selected.includes(playerId) ? selected.filter((id) => id !== playerId) : [...selected, playerId]);
  }

  if (players.length === 0) {
    return <p className="text-textMuted text-sm">{t("team.noPlayers")}</p>;
  }

  return (
    <div>
      <p className="text-textMuted text-xs mb-2">{t("team.activePlayers")}</p>
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
