"use client";

import { useI18n } from "@/i18n/client";

export function PlaybackControls({ isPlaying, playbackRate, onBack, onTogglePlay, onCycleSpeed }: {
  isPlaying: boolean;
  playbackRate: number;
  onBack: () => void;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
}) {
  const { t } = useI18n();
  const buttonClass = "flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg border border-borderButton bg-button px-1 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-cardHover";

  return (
    <div>
      <p className="mb-2 text-center text-xs text-textMuted">{t("video.playback")}</p>
      <div className="flex w-full gap-2">
        <button type="button" onClick={onBack} className={buttonClass} title={t("video.backFive")} aria-label={t("video.backFive")}>‹ 5s</button>
        <button type="button" onClick={onTogglePlay} className={buttonClass} title={isPlaying ? t("video.pause") : t("video.play")} aria-label={isPlaying ? t("video.pause") : t("video.play")}>{isPlaying ? "Ⅱ" : "▶"}</button>
        <button type="button" onClick={onCycleSpeed} className={buttonClass} title={t("video.speed")} aria-label={`${t("video.speed")} ${playbackRate}×`}>› {playbackRate}×</button>
      </div>
    </div>
  );
}
