export function PlaybackControls({ isPlaying, playbackRate, onBack, onTogglePlay, onCycleSpeed }: {
  isPlaying: boolean;
  playbackRate: number;
  onBack: () => void;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
}) {
  const buttonClass = "flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg border border-borderButton bg-button px-1 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-cardHover";

  return (
    <div>
      <p className="mb-2 text-center text-xs text-textMuted">Playback</p>
      <div className="flex w-full gap-2">
        <button type="button" onClick={onBack} className={buttonClass} title="Back 5 seconds" aria-label="Back 5 seconds">‹ 5s</button>
        <button type="button" onClick={onTogglePlay} className={buttonClass} title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? "Ⅱ" : "▶"}</button>
        <button type="button" onClick={onCycleSpeed} className={buttonClass} title="Change playback speed" aria-label={`Playback speed ${playbackRate} times`}>› {playbackRate}×</button>
      </div>
    </div>
  );
}
