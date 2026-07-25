"use client";

import { useI18n } from "@/i18n/client";

export function ClipCard({
  name,
  videoTitle,
  segmentCount,
  audienceLabel,
  processing = false,
  onClick,
  onDelete
}: {
  name: string;
  videoTitle: string;
  segmentCount: number;
  audienceLabel?: string;
  processing?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="group relative">
    <button
      type="button"
      onClick={onClick}
      disabled={processing}
      className={`h-full w-full rounded-xl border p-4 text-left transition ${
        processing
          ? "cursor-wait border-accent/40 bg-card"
          : "border-border bg-card hover:bg-cardHover"
      }`}
    >
      <p className="text-textBright font-medium truncate">{name}</p>
      <p className="text-textMuted text-sm mt-1 truncate">{videoTitle}</p>
      <p className="text-textMuted text-xs mt-2">
        {segmentCount === 1 ? t("clip.segment") : t("clip.segments", { count: segmentCount })}
      </p>
      {processing && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
          {t("clip.processing")}
        </p>
      )}
      {audienceLabel && <p className="mt-2 line-clamp-2 text-xs text-textSecondary"><span className="font-semibold text-textPrimary">{t("clip.sharedWith")}</span> {audienceLabel}</p>}
    </button>
    {onDelete && <button type="button" onClick={onDelete} aria-label={t("tag.deleteNamed", { name })} title={t("clip.delete")} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-cardAlt text-textMuted opacity-100 hover:bg-red-500/15 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100">&times;</button>}
    </div>
  );
}
