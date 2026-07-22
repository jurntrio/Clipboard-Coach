import type { Tag } from "@/types/database";
import { formatTime } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";

function arrangeInLanes(tags: Tag[]) {
  const laneEnds: number[] = [];
  const laneByTag = new Map<string, number>();

  for (const tag of [...tags].sort((a, b) => a.start_time - b.start_time || a.end_time - b.end_time)) {
    let lane = laneEnds.findIndex((endTime) => endTime <= tag.start_time);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(tag.end_time);
    } else {
      laneEnds[lane] = tag.end_time;
    }
    laneByTag.set(tag.id, lane);
  }

  return { laneByTag, laneCount: laneEnds.length };
}

export function Timeline({ duration, currentTime, tags, onSeek }: {
  duration: number;
  currentTime: number;
  tags: Tag[];
  onSeek: (time: number) => void;
}) {
  const safeDuration = duration > 0 ? duration : 1;
  const markers = tags.filter((tag) => isPeriodMarker(tag.name));
  const clipTags = tags.filter((tag) => !isPeriodMarker(tag.name));
  const { laneByTag, laneCount } = arrangeInLanes(clipTags);
  const bandHeight = Math.max(32, 5 + laneCount * 27);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  }

  return (
    <div className="shrink-0 space-y-1.5">
      <div className="flex justify-between px-1 text-[10px] text-textMuted">
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="relative h-6" aria-label="Period markers">
        {markers.map((tag) => {
          const endMarker = tag.name.trim().toLowerCase() === "end";
          return (
            <button type="button" key={tag.id} title={`${tag.name} · ${formatTime(tag.start_time)}`} aria-label={`${tag.name} at ${formatTime(tag.start_time)}`} className="absolute top-0 z-10 h-6 w-5 -translate-x-1/2 transition hover:scale-110" style={{ left: `${(tag.start_time / safeDuration) * 100}%` }} onClick={() => onSeek(tag.start_time)}>
              <span className={`absolute bottom-0 left-1 h-6 border-l-2 ${endMarker ? "border-white" : "border-accent"}`} />
              <span className={`absolute left-1 top-0 h-3 w-4 rounded-r-sm ${endMarker ? "border border-white" : "bg-accent"}`} style={endMarker ? { backgroundImage: "conic-gradient(#fff 25%, #111 0 50%, #fff 0 75%, #111 0)", backgroundSize: "6px 6px" } : undefined} />
            </button>
          );
        })}
      </div>
      <div className="relative h-5 cursor-pointer overflow-hidden rounded-md border border-border bg-input" onClick={handleClick} aria-label="Match timeline">
        <div className="absolute inset-y-0 left-0 bg-accent/20" style={{ width: `${Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-white" style={{ left: `${Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))}%` }} />
      </div>

      <div className="max-h-32 overflow-y-auto rounded-md border border-borderSubtle bg-cardDeep" aria-label="Tag bands">
        <div className="relative min-w-full" style={{ height: bandHeight }}>
          {clipTags.map((tag) => (
            <button
              type="button"
              key={tag.id}
              title={`${tag.name} · ${formatTime(tag.start_time)}–${formatTime(tag.end_time)}`}
              className="absolute h-5 min-w-1 overflow-hidden whitespace-nowrap rounded-sm px-1 text-[10px] font-semibold text-black/80 opacity-85 hover:opacity-100"
              style={{
                top: 4 + (laneByTag.get(tag.id) ?? 0) * 27,
                left: `${(tag.start_time / safeDuration) * 100}%`,
                width: `${Math.max(0.7, ((tag.end_time - tag.start_time) / safeDuration) * 100)}%`,
                backgroundColor: tag.color
              }}
              onClick={() => onSeek(tag.start_time)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
