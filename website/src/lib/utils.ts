// Same palette + hash as the desktop app's getTagColor (src/App.tsx) so tag
// colors match between the Electron app and the website for the same label.
const tagColors = ["#68d51b", "#3aa7ff", "#ffb020", "#d66bff", "#ff6b6b", "#4dd8c8", "#f07db1"];

export function getTagColor(label: string): string {
  const normalized = label.trim().toLowerCase();
  let hash = 0;

  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) % tagColors.length;
  }

  return tagColors[Math.abs(hash) % tagColors.length];
}

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getPlayerDisplayName(player: { first_name: string; last_name: string }): string {
  return `${player.first_name} ${player.last_name}`.trim();
}
