export function ClipCard({
  name,
  videoTitle,
  segmentCount,
  onClick
}: {
  name: string;
  videoTitle: string;
  segmentCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-card rounded-xl border border-border p-4 hover:bg-cardHover transition"
    >
      <p className="text-textBright font-medium truncate">{name}</p>
      <p className="text-textMuted text-sm mt-1 truncate">{videoTitle}</p>
      <p className="text-textMuted text-xs mt-2">
        {segmentCount} segment{segmentCount === 1 ? "" : "s"}
      </p>
    </button>
  );
}
