import type { Tag } from "@/types/database";
import { formatTime } from "@/lib/utils";

export function TagList({
  tags,
  selectedTagIds,
  onToggleSelect,
  onSeek,
  onDelete
}: {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleSelect: (tagId: string) => void;
  onSeek: (time: number) => void;
  onDelete: (tagId: string) => void;
}) {
  if (tags.length === 0) {
    return <p className="text-textMuted text-sm">No tags yet. Play the video and tap a tag button.</p>;
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${
            selectedTagIds.includes(tag.id) ? "bg-accentDim" : "hover:bg-cardHover"
          }`}
        >
          <input
            type="checkbox"
            checked={selectedTagIds.includes(tag.id)}
            onChange={() => onToggleSelect(tag.id)}
          />
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
          <button onClick={() => onSeek(tag.start_time)} className="flex-1 text-left text-textPrimary text-sm truncate">
            {tag.name}
          </button>
          <span className="text-textMuted text-xs">{formatTime(tag.start_time)}</span>
          <button onClick={() => onDelete(tag.id)} className="text-textMuted hover:text-red-400 text-xs px-1">
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
