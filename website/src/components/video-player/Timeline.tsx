import type { Tag } from "@/types/database";

export function Timeline({
  duration,
  currentTime,
  tags,
  onSeek
}: {
  duration: number;
  currentTime: number;
  tags: Tag[];
  onSeek: (time: number) => void;
}) {
  const safeDuration = duration > 0 ? duration : 1;

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  }

  return (
    <div
      className="relative h-10 bg-input rounded-lg cursor-pointer border border-border"
      onClick={handleClick}
    >
      {tags.map((tag) => (
        <div
          key={tag.id}
          title={tag.name}
          className="absolute top-0 h-full opacity-70 hover:opacity-100"
          style={{
            left: `${(tag.start_time / safeDuration) * 100}%`,
            width: `${Math.max(0.5, ((tag.end_time - tag.start_time) / safeDuration) * 100)}%`,
            backgroundColor: tag.color
          }}
        />
      ))}
      <div
        className="absolute top-0 h-full w-0.5 bg-white"
        style={{ left: `${(currentTime / safeDuration) * 100}%` }}
      />
    </div>
  );
}
