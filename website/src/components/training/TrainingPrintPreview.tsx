"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { Pitch } from "@/components/training/Pitch";
import type { Block } from "@/components/training/types";

function paginatePrintBlocks(blocks: Block[], measuredHeights: Record<string, number>) {
  if (!blocks.length) return [[null] as (Block | null)[]];
  const printableBodyHeight = 960;
  const minimumDrawingHeight = 270;
  const pages: (Block | null)[][] = [];
  let current: Block[] = [];
  let usedHeight = 0;
  for (const block of blocks) {
    const requiredHeight = Math.max(minimumDrawingHeight, measuredHeights[block.id] ?? minimumDrawingHeight);
    if (current.length && (current.length >= 3 || usedHeight + requiredHeight > printableBodyHeight)) {
      pages.push(current);
      current = [];
      usedHeight = 0;
    }
    current.push(block);
    usedHeight += requiredHeight;
  }
  if (current.length) pages.push(current);
  return pages;
}

export function PrintPreview({ name, team, clubLogoUrl, date, playerCount, keeperCount, trainers, teamTactics, themes, material, blocks, onClose }: {
  name: string; team: string; date: string; playerCount: number; keeperCount: number;
  clubLogoUrl: string | null; trainers: string[]; teamTactics: string[]; themes: string[]; material: string; blocks: Block[]; onClose: () => void;
}) {
  const activeBlocks = blocks.filter(block => block.active);
  const measurementRefs = useRef(new Map<string, HTMLDivElement>());
  const [pages, setPages] = useState<(Block | null)[][]>(() => paginatePrintBlocks(activeBlocks, {}));
  useLayoutEffect(() => {
    const heights: Record<string, number> = {};
    for (const block of activeBlocks) {
      const element = measurementRefs.current.get(block.id);
      if (element) heights[block.id] = Math.ceil(element.getBoundingClientRect().height) + 22;
    }
    setPages(paginatePrintBlocks(activeBlocks, heights));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);
  const formattedDate = date ? new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "—";
  return <div className="training-print-overlay fixed inset-0 z-[120] overflow-auto bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Afdrukvoorbeeld training">
    <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 w-[500px] bg-white text-[#182019]">
      {activeBlocks.map(block => <div key={block.id} ref={element => {
        if (element) measurementRefs.current.set(block.id, element);
        else measurementRefs.current.delete(block.id);
      }} className="py-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black">{block.label || "Oefening"}</h2><span className="text-xs font-bold">{block.minutes} min.</span>
        </div>
        <div className="mt-1 space-y-2">
          <PrintText label="Organisatie" value={block.organisation} compact />
          <PrintText label="Verloop" value={block.flow} compact />
          <PrintText label="Coaching" value={block.coaching} compact />
        </div>
      </div>)}
    </div>
    <div className="training-print-toolbar sticky top-0 z-10 mx-auto mb-4 flex max-w-[1188px] items-center justify-between gap-3 rounded-xl bg-[#101713] px-4 py-3 text-white shadow-xl">
      <div><strong>Afdrukvoorbeeld</strong><p className="text-xs text-white/60">A4 staand · maximaal drie oefeningen per pagina</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#71d52b] px-4 py-2 text-sm font-black text-[#101713]">Afdrukken</button>
        <button type="button" onClick={onClose} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">Sluiten</button>
      </div>
    </div>
    <div className="mx-auto grid max-w-[840px] gap-5">
      {pages.map((pageBlocks, pageIndex) => <article key={`page-${pageIndex}`} className="training-print-page flex aspect-[210/297] flex-col overflow-hidden bg-white p-[3.5%] text-[#182019] shadow-2xl">
        <header className="border-b-2 border-[#169447] pb-2">
          <div className="flex items-stretch gap-3">
            {clubLogoUrl && <Image src={clubLogoUrl} alt="" width={58} height={58} className="h-[58px] w-[58px] shrink-0 self-center object-contain" unoptimized />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.18em] text-[#169447]">Clipboard Coach</p><h1 className="truncate text-base font-black">{name || "Nieuwe training"}</h1></div>
                <div className="text-right text-[9px] text-[#66706b]"><strong className="block text-[11px] text-[#182019]">{team || "Vrije ploeg"}</strong>{formattedDate}</div>
              </div>
              <dl className="mt-1.5 grid grid-cols-4 gap-x-3 text-[8px] leading-tight">
                <div><dt className="font-bold uppercase text-[#66706b]">Spelers</dt><dd>{playerCount} + {keeperCount} keepers</dd></div>
                <div><dt className="font-bold uppercase text-[#66706b]">Trainer(s)</dt><dd>{trainers.join(", ") || "—"}</dd></div>
                {!!teamTactics.length && <div><dt className="font-bold uppercase text-[#66706b]">TeamTactics</dt><dd>{teamTactics.join(", ")}</dd></div>}
                <div><dt className="font-bold uppercase text-[#66706b]">Thema&apos;s</dt><dd>{themes.join(", ") || "—"}</dd></div>
                <div><dt className="font-bold uppercase text-[#66706b]">Materiaal</dt><dd>{material || "—"}</dd></div>
              </dl>
            </div>
          </div>
        </header>
        <div className="mt-2 grid min-h-0 flex-1 gap-2" style={{ gridTemplateRows: `repeat(${pageBlocks.length}, minmax(0, 1fr))` }}>
          {pageBlocks.map(block => block ? <section key={block.id} className="grid min-h-0 grid-cols-[38%_1fr] gap-4 overflow-hidden border-b border-[#dbe2de] pb-2 last:border-b-0">
            <div className="flex min-h-0 items-center justify-center overflow-hidden">
              <div className="h-full max-w-full overflow-hidden border border-[#cad4ce] bg-white" style={{ aspectRatio: "414 / 612" }}>
                <Pitch fieldType={block.fieldType} items={block.items} lines={block.lines} areas={block.areas} dribbles={block.dribbles} preview />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-base font-black">{block.label || "Oefening"}</h2></div>
                <span className="whitespace-nowrap text-xs font-bold">{block.minutes} min.</span>
              </div>
              <div className="mt-1 space-y-2">
                <PrintText label="Organisatie" value={block.organisation} compact />
                <PrintText label="Verloop" value={block.flow} compact />
                <PrintText label="Coaching" value={block.coaching} compact />
              </div>
            </div>
          </section> : <div key="empty" className="grid h-3/4 place-items-center text-[#66706b]">Geen actieve oefeningen om af te drukken.</div>)}
        </div>
        <footer className="mt-1 flex justify-between border-t border-[#dbe2de] pt-1 text-[8px] text-[#7a857f]"><span>{name || "Training"}</span><span>Pagina {pageIndex + 1} van {pages.length}</span></footer>
      </article>)}
    </div>
  </div>;
}

function PrintText({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <section className={compact ? "" : "mt-4"}><h3 className={`${compact ? "text-[9px]" : "text-xs"} font-black uppercase tracking-wide text-[#169447]`}>{label}</h3><p className={`${compact ? "mt-0.5 text-[10px] leading-snug" : "mt-1 text-sm leading-relaxed"} whitespace-pre-wrap text-[#2e3832]`}>{value || "—"}</p></section>;
}
