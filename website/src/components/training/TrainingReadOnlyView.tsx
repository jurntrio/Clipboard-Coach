import { Pitch } from "@/components/training/Pitch";
import { ReadOnlyText } from "@/components/training/ReadOnlyText";
import type { Block } from "@/components/training/types";

export function TrainingReadOnlyView({ blocks = [] }: { blocks?: Partial<Block>[] }) {
  const visibleBlocks = blocks.filter(block => block.active !== false);

  if (!visibleBlocks.length) {
    return <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Deze training bevat nog geen oefeningen.</p>;
  }

  return <div className="space-y-5">
    {visibleBlocks.map((block, index) => (
      <article key={block.id ?? index} className="overflow-hidden rounded-2xl border border-borderSubtle bg-cardDeep">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-borderSubtle px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-accent">{block.code || `Oefening ${index + 1}`}</p>
            <h3 className="font-black text-textBright">{block.label || block.title || `Oefening ${index + 1}`}</h3>
          </div>
          <span className="rounded-full bg-card px-3 py-1 text-sm font-bold text-textSecondary">{block.minutes ?? 0} min.</span>
        </header>
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(300px,620px)_1fr]">
          <Pitch
            fieldType={block.fieldType ?? "full"}
            items={block.items ?? []}
            lines={block.lines ?? []}
            areas={block.areas ?? []}
            dribbles={block.dribbles ?? []}
            preview
          />
          <div className="grid content-start gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <ReadOnlyText label="Organisatie" value={block.organisation} />
            <ReadOnlyText label="Verloop" value={block.flow} />
            <ReadOnlyText label="Coaching" value={block.coaching} />
          </div>
        </div>
      </article>
    ))}
  </div>;
}
