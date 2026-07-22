export function ClipCard({
  name,
  videoTitle,
  segmentCount,
  audienceLabel,
  onClick,
  onDelete
}: {
  name: string;
  videoTitle: string;
  segmentCount: number;
  audienceLabel?: string;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative">
    <button onClick={onClick} className="h-full w-full text-left bg-card rounded-xl border border-border p-4 hover:bg-cardHover transition">
      <p className="text-textBright font-medium truncate">{name}</p>
      <p className="text-textMuted text-sm mt-1 truncate">{videoTitle}</p>
      <p className="text-textMuted text-xs mt-2">
        {segmentCount} segment{segmentCount === 1 ? "" : "s"}
      </p>
      {audienceLabel && <p className="mt-2 line-clamp-2 text-xs text-textSecondary"><span className="font-semibold text-textPrimary">Shared with:</span> {audienceLabel}</p>}
    </button>
    {onDelete && <button type="button" onClick={onDelete} aria-label={`Delete ${name}`} title="Delete clip" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-cardAlt text-textMuted opacity-100 hover:bg-red-500/15 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100">&times;</button>}
    </div>
  );
}
