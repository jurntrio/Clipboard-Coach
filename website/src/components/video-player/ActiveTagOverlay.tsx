import type { Tag } from "@/types/database";
import { isPeriodMarker } from "@/lib/tags";

export function ActiveTagOverlay({ tags, currentTime }: { tags: Tag[]; currentTime: number }) {
  const activeTags = tags.filter((tag) => !isPeriodMarker(tag.name) && currentTime >= tag.start_time && currentTime < tag.end_time);
  if (!activeTags.length) return null;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-w-[70%] flex-col items-end gap-2" aria-live="polite">
      {activeTags.map((tag) => (
        <div key={tag.id} className="rounded-lg border-2 bg-black/80 px-3 py-2 text-sm font-bold shadow-lg backdrop-blur-sm" style={{ borderColor: tag.color, color: tag.color, boxShadow: `0 0 18px ${tag.color}55` }}>
          {tag.name}
        </div>
      ))}
    </div>
  );
}
