"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TRAINING_AGE_CATEGORIES } from "@/lib/training-categories";

const ASSET_ROOT = "/branding/Training";
const FIELD_SRC = `${ASSET_ROOT}/11vs11.jpg`;
const colors = [
  { file: "Groen", label: "Groen" }, { file: "Blauw", label: "Blauw" },
  { file: "Zwart", label: "Zwart" }, { file: "Wit", label: "Wit" },
  { file: "Rood", label: "Rood" }
] as const;
const playerFamilies = [
  { file: "Shirt", label: "Shirts" }, { file: "Circel", label: "Cirkels" },
  { file: "Square", label: "Vierkanten" }
] as const;
const balls = [
  ["VoetbalWit.png", "Voetbal"], ["Tennisbal.png", "Tennisbal"], ["BasketbalZwart.png", "Basketbal"],
  ["VolleybalZwart.png", "Volleybal"], ["RugbyBalZwart.png", "Rugbybal"],
  ["AmericanFootballbalZwart.png", "American football"], ["KrachtbalZwart.png", "Krachtbal"]
] as const;
const otherEquipment = [
  ["MinigoalZwart.png", "Minidoel"], ["Grote_goalZwart.png", "Groot doel"], ["DuivelsgoalZwart.png", "Duivelsdoel"],
  ["DrankflesZwart.png", "Drankfles"], ["SpringtouwZwart.png", "Springtouw"],
  ["FluitjeZwart.png", "Fluitje"], ["ChronoZwart.png", "Chronometer"],
  ["ClipboardZwart.png", "Clipboard"], ["7Zwart.png", "Markering"]
] as const;
const phases = [
  "Warming-up", "Vorm 1", "Vorm 2", "Vorm 3", "Vorm 4", "Cooling-down"
] as const;
type PaletteAsset = { src: string; label: string };
type FieldItem = PaletteAsset & { id: string; x: number; y: number; scale: number; rotation: number; stretchX?: number; stretchY?: number };
type FieldLine = {
  id: string; x1: number; y1: number; x2: number; y2: number;
  style: "solid" | "dashed"; color: string; number?: number;
};
type AreaStyle = "outline" | "fill" | "hatched";
type FieldArea = { id: string; points: { x: number; y: number }[]; color: string; style: AreaStyle; number?: number };
type FieldDribble = { id: string; points: { x: number; y: number }[]; color: string; number?: number };
type SelectedDrawing = { kind: "line" | "area" | "dribble"; id: string } | null;
type Block = {
  id: string; code: string; label: string; active: boolean; title: string; minutes: number;
  organisation: string; flow: string; coaching: string; items: FieldItem[]; lines: FieldLine[]; areas: FieldArea[]; dribbles: FieldDribble[];
};

function path(file: string) { return `${ASSET_ROOT}/${file}`; }
function makeBlocks(): Block[] {
  return phases.map((label, index) => ({
    id: `default-phase-${index}`,
    code: "",
    label,
    active: true,
    title: "",
    minutes: index === 0 ? 15 : 10,
    organisation: "",
    flow: "",
    coaching: "",
    items: [],
    lines: [],
    areas: [],
    dribbles: []
  }));
}

function MultiValueInput({ values, onChange, placeholder, suggestions = [] }: {
  values: string[]; onChange: (values: string[]) => void; placeholder: string; suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  function add(value = draft) {
    const clean = value.trim();
    if (!clean || values.some(item => item.toLocaleLowerCase() === clean.toLocaleLowerCase())) return;
    onChange([...values, clean]);
    setDraft("");
  }
  return <div className="mt-1 rounded-lg border border-border bg-input px-2 py-1.5 focus-within:border-accent">
    <div className="flex flex-wrap gap-1.5">
      {values.map(value => <span key={value} className="inline-flex items-center gap-1 rounded-full bg-accentDim px-2 py-1 text-xs font-semibold text-textPrimary">
        {value}
        <button type="button" aria-label={`${value} verwijderen`} onClick={() => onChange(values.filter(item => item !== value))} className="text-textMuted hover:text-red-400">×</button>
      </span>)}
      <input value={draft} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); }
          if (event.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => add()} list={suggestions.length ? `${placeholder.replace(/\W/g, "-")}-suggestions` : undefined}
        placeholder={values.length ? "Nog toevoegen…" : placeholder}
        className="min-w-28 flex-1 bg-transparent px-1 py-1 text-sm normal-case text-textBright outline-none" />
      {!!suggestions.length && <datalist id={`${placeholder.replace(/\W/g, "-")}-suggestions`}>
        {suggestions.filter(item => !values.includes(item)).map(item => <option key={item} value={item} />)}
      </datalist>}
    </div>
  </div>;
}

function PlayerGroup({ family, onPick, activeSrc }: {
  family: typeof playerFamilies[number]; onPick: (asset: PaletteAsset) => void; activeSrc?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const numbers = expanded ? Array.from({ length: 20 }, (_, i) => i + 1) : [1, 2];
  return (
    <section className="rounded-lg border border-[#dbe2de] bg-white p-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-[#243029]">{family.label}</h3>
        <button type="button" onClick={() => setExpanded(v => !v)} className="rounded border border-[#cbd5cf] px-2 py-1 text-[10px] font-bold text-[#36423b]">
          {expanded ? "1–2 ▴" : "3–20 ▾"}
        </button>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {colors.map(color => (
          <div key={color.file} className="col-span-2 grid grid-cols-2 content-start gap-1">
            <span className="col-span-2 truncate text-center text-[7px] font-bold uppercase text-[#7a857f]">{color.label}</span>
            {numbers.map(number => {
              const suffix = number === 1 ? "1_2" : String(number);
              const asset = { src: path(`${family.file}${color.file}${suffix}.png`), label: `${family.label} ${color.label} ${number}` };
              return <AssetButton key={number} asset={asset} onPick={onPick} active={activeSrc === asset.src} player />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function AssetButton({ asset, onPick, active = false, player = false }: {
  asset: PaletteAsset; onPick: (asset: PaletteAsset) => void; active?: boolean; player?: boolean;
}) {
  return (
    <button type="button" title={asset.label} onClick={() => onPick(asset)}
      className={`${player ? "aspect-square p-0.5" : "h-10 p-1"} group min-w-0 rounded border border-[#dbe2de] border-l-4 ${active ? "border-l-[#169447] bg-[#eef8f1] shadow-sm" : "border-l-transparent bg-white"} hover:border-[#169447] hover:bg-[#eef8f1]`}>
      <Image src={asset.src} alt="" width={44} height={44} className="mx-auto h-full max-h-[34px] w-full object-contain transition-transform group-hover:scale-110" />
    </button>
  );
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let pathData = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
  }
  return pathData;
}

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

function PrintPreview({ name, team, clubLogoUrl, date, playerCount, keeperCount, trainers, themes, material, blocks, onClose }: {
  name: string; team: string; date: string; playerCount: number; keeperCount: number;
  clubLogoUrl: string | null; trainers: string[]; themes: string[]; material: string; blocks: Block[]; onClose: () => void;
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
                <Pitch items={block.items} lines={block.lines} areas={block.areas} dribbles={block.dribbles} preview />
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

function Pitch({ items, lines, areas, dribbles, preview = false, onOpen, selectedId, selectedDrawing, drawingInteractive = true, onSelect, onDeleteItem, onSelectDrawing, onDrawingPointerDown, onDrawingPointerMove, onMove, onResize, onRotate, pendingLine, pendingLineStyle, pendingArea, pendingAreaStyle = "outline", pendingDribble, hoverPoint, drawingColor = "#111111" }: {
  items: FieldItem[]; lines: FieldLine[]; areas: FieldArea[]; dribbles: FieldDribble[]; preview?: boolean; onOpen?: () => void; selectedId?: string | null;
  selectedDrawing?: SelectedDrawing;
  drawingInteractive?: boolean;
  onSelect?: (id: string) => void; onDeleteItem?: (id: string) => void;
  onMove?: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  onSelectDrawing?: (drawing: Exclude<SelectedDrawing, null>) => void;
  onDrawingPointerDown?: (event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) => void;
  onDrawingPointerMove?: (event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) => void;
  onResize?: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  onRotate?: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  pendingLine?: { x: number; y: number } | null;
  pendingLineStyle?: "solid" | "dashed" | null;
  pendingArea?: { x: number; y: number }[];
  pendingAreaStyle?: AreaStyle;
  pendingDribble?: { x: number; y: number }[];
  hoverPoint?: { x: number; y: number } | null;
  drawingColor?: string;
}) {
  return (
    <div onClick={onOpen} className={`relative aspect-[414/612] w-full overflow-hidden bg-white ${preview ? "cursor-pointer" : "cursor-crosshair"}`}>
      <Image src={FIELD_SRC} alt="11 tegen 11 voetbalveld" fill sizes={preview ? "360px" : "620px"} className="pointer-events-none object-contain" priority />
      <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id={preview ? "training-arrow-preview" : "training-arrow-editor"} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
          {areas.map(area => <pattern key={area.id} id={`training-hatch-${area.id}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={area.color} strokeWidth=".7" />
          </pattern>)}
          <pattern id="training-hatch-pending" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={drawingColor} strokeWidth=".7" />
          </pattern>
        </defs>
        {areas.map(area => (
          <polygon key={area.id} points={area.points.map(point => `${point.x},${point.y}`).join(" ")}
            fill={area.style === "outline" ? "none" : area.style === "hatched" ? `url(#training-hatch-${area.id})` : area.color}
            color={area.color} fillOpacity={area.style === "fill" ? ".18" : "1"} stroke={area.color}
            strokeWidth={selectedDrawing?.kind === "area" && selectedDrawing.id === area.id ? "1.35" : ".65"}
            vectorEffect="non-scaling-stroke" className={preview || !drawingInteractive ? "pointer-events-none" : "pointer-events-auto cursor-move"}
            onPointerDown={event => onDrawingPointerDown?.(event, { kind: "area", id: area.id })}
            onPointerMove={event => onDrawingPointerMove?.(event, { kind: "area", id: area.id })}
            onClick={event => { event.stopPropagation(); onSelectDrawing?.({ kind: "area", id: area.id }); }} />
        ))}
        {lines.map(line => (
          <g key={line.id} className={preview || !drawingInteractive ? "pointer-events-none" : "pointer-events-auto cursor-move"}
            onPointerDown={event => onDrawingPointerDown?.(event, { kind: "line", id: line.id })}
            onPointerMove={event => onDrawingPointerMove?.(event, { kind: "line", id: line.id })}
            onClick={event => { event.stopPropagation(); onSelectDrawing?.({ kind: "line", id: line.id }); }}>
            {!preview && <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="transparent" strokeWidth="10" />}
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={line.color || "#111111"} strokeWidth={selectedDrawing?.kind === "line" && selectedDrawing.id === line.id ? "1.35" : ".65"} vectorEffect="non-scaling-stroke"
              strokeDasharray={line.style === "dashed" ? "3 2" : undefined}
              markerEnd={`url(#${preview ? "training-arrow-preview" : "training-arrow-editor"})`} />
            {line.number && <>
              <circle cx={(line.x1 + line.x2) / 2} cy={(line.y1 + line.y2) / 2} r="1.35" fill="white" stroke={line.color || "#111111"} strokeWidth=".3" />
              <text x={(line.x1 + line.x2) / 2} y={(line.y1 + line.y2) / 2 + .45} textAnchor="middle" fontSize="1.3" fontWeight="700" fill={line.color || "#111111"}>{line.number}</text>
            </>}
          </g>
        ))}
        {dribbles.map(dribble => (
          <g key={dribble.id} className={preview || !drawingInteractive ? "pointer-events-none" : "pointer-events-auto cursor-move"}
            onPointerDown={event => onDrawingPointerDown?.(event, { kind: "dribble", id: dribble.id })}
            onPointerMove={event => onDrawingPointerMove?.(event, { kind: "dribble", id: dribble.id })}
            onClick={event => { event.stopPropagation(); onSelectDrawing?.({ kind: "dribble", id: dribble.id }); }}>
            {!preview && <path d={smoothPath(dribble.points)} fill="none" stroke="transparent" strokeWidth="10" />}
            <path d={smoothPath(dribble.points)} fill="none" stroke={dribble.color} strokeWidth={selectedDrawing?.kind === "dribble" && selectedDrawing.id === dribble.id ? "1.35" : ".65"} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {!preview && pendingLine && hoverPoint && (
          <line x1={pendingLine.x} y1={pendingLine.y} x2={hoverPoint.x} y2={hoverPoint.y}
            stroke={drawingColor} strokeOpacity=".65" strokeWidth=".65" strokeDasharray={pendingLineStyle === "dashed" ? "3 2" : undefined}
            markerEnd="url(#training-arrow-editor)" vectorEffect="non-scaling-stroke" />
        )}
        {!preview && pendingArea && pendingArea.length > 0 && (
          pendingArea.length >= 2 && hoverPoint
            ? <polygon points={[...pendingArea, hoverPoint].map(point => `${point.x},${point.y}`).join(" ")}
                fill={pendingAreaStyle === "outline" ? "none" : pendingAreaStyle === "hatched" ? "url(#training-hatch-pending)" : drawingColor}
                color={drawingColor} fillOpacity={pendingAreaStyle === "fill" ? ".18" : "1"} stroke={drawingColor} strokeOpacity=".75" strokeWidth=".65" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />
            : <polyline points={[...pendingArea, ...(hoverPoint ? [hoverPoint] : [])].map(point => `${point.x},${point.y}`).join(" ")}
                fill="none" stroke={drawingColor} strokeOpacity=".65" strokeWidth=".65" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />
        )}
        {!preview && pendingDribble && pendingDribble.length > 0 && (
          <path d={smoothPath([...pendingDribble, ...(hoverPoint ? [hoverPoint] : [])])}
            fill="none" stroke={drawingColor} strokeOpacity=".75" strokeWidth=".65" strokeLinecap="round"
            strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" />
        )}
        {areas.filter(area => area.number).map(area => {
          const center = area.points.reduce((sum, point) => ({ x: sum.x + point.x / area.points.length, y: sum.y + point.y / area.points.length }), { x: 0, y: 0 });
          return <g key={`${area.id}-number`} className="pointer-events-none">
            <circle cx={center.x} cy={center.y} r="1.8" fill="white" stroke={area.color} strokeWidth=".3" />
            <text x={center.x} y={center.y + .55} textAnchor="middle" fontSize="1.6" fontWeight="700" fill={area.color}>{area.number}</text>
          </g>;
        })}
        {dribbles.filter(dribble => dribble.number).map(dribble => {
          const point = dribble.points[Math.floor(dribble.points.length / 2)];
          return <g key={`${dribble.id}-number`} className="pointer-events-none">
            <circle cx={point.x} cy={point.y} r="1.35" fill="white" stroke={dribble.color} strokeWidth=".3" />
            <text x={point.x} y={point.y + .45} textAnchor="middle" fontSize="1.3" fontWeight="700" fill={dribble.color}>{dribble.number}</text>
          </g>;
        })}
        {!preview && drawingInteractive && selectedDrawing?.kind === "line" && lines.filter(line => line.id === selectedDrawing.id).map(line =>
          [[line.x1, line.y1], [line.x2, line.y2]].map(([x, y], index) =>
            <circle key={index} cx={x} cy={y} r="1.5" fill="#169447" stroke="white" strokeWidth=".55"
              className="pointer-events-auto cursor-grab"
              onPointerDown={event => onDrawingPointerDown?.(event, selectedDrawing, index)}
              onPointerMove={event => onDrawingPointerMove?.(event, selectedDrawing, index)} />))}
        {!preview && drawingInteractive && selectedDrawing?.kind === "area" && areas.filter(area => area.id === selectedDrawing.id).flatMap(area =>
          area.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="#169447" stroke="white" strokeWidth=".55"
            className="pointer-events-auto cursor-grab"
            onPointerDown={event => onDrawingPointerDown?.(event, selectedDrawing, index)}
            onPointerMove={event => onDrawingPointerMove?.(event, selectedDrawing, index)} />))}
        {!preview && drawingInteractive && selectedDrawing?.kind === "dribble" && dribbles.filter(dribble => dribble.id === selectedDrawing.id).flatMap(dribble =>
          dribble.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="#169447" stroke="white" strokeWidth=".55"
            className="pointer-events-auto cursor-grab"
            onPointerDown={event => onDrawingPointerDown?.(event, selectedDrawing, index)}
            onPointerMove={event => onDrawingPointerMove?.(event, selectedDrawing, index)} />))}
      </svg>
      {items.map(item => (
        <div key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%`, width: "5.5%", aspectRatio: "1", transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale}) scaleX(${item.stretchX ?? 1}) scaleY(${item.stretchY ?? 1})` }} className="pointer-events-none absolute z-10">
          <button type="button" title={item.label}
            onPointerDown={event => { event.stopPropagation(); onSelect?.(item.id); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => onMove?.(event, item.id)}
            onClick={event => { event.stopPropagation(); onSelect?.(item.id); }}
            className={`pointer-events-auto absolute inset-0 touch-none rounded-sm ${preview ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"} ${selectedId === item.id ? "outline outline-2 outline-[#169447] outline-offset-2" : ""}`}>
            <Image src={item.src} alt="" fill sizes="40px" className="pointer-events-none object-contain drop-shadow-sm" />
          </button>
          {!preview && selectedId === item.id && <>
            <span className="pointer-events-none absolute inset-0 border border-dashed border-[#169447]" />
            <button type="button" aria-label="Icoon vergroten of verkleinen"
              onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => onResize?.(event, item.id)}
              onClick={event => event.stopPropagation()}
              className="pointer-events-auto absolute -bottom-2 -right-2 z-30 h-4 w-4 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-[#169447] shadow" />
            <button type="button" aria-label="Icoon draaien"
              onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => onRotate?.(event, item.id)}
              onClick={event => event.stopPropagation()}
              className="pointer-events-auto absolute -top-7 left-1/2 z-30 grid h-5 w-5 -translate-x-1/2 touch-none cursor-grab place-items-center rounded-full border-2 border-white bg-[#182019] text-[10px] text-white shadow">↻</button>
            <button type="button" aria-label="Icoon verwijderen" onClick={event => { event.stopPropagation(); onDeleteItem?.(item.id); }}
              className="pointer-events-auto absolute -left-8 top-1/2 z-30 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#b42323] text-white shadow">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
              </svg>
            </button>
          </>}
        </div>
      ))}
    </div>
  );
}

export function TrainingBuilder({ initialTrainer = "", teamOptions = [], trainerOptions = [], clubOptions = [], initialTraining, editingTrainingId }: {
  initialTrainer?: string;
  teamOptions?: { id: string; name: string; assigned: boolean; clubLogoUrl: string | null }[];
  trainerOptions?: string[];
  clubOptions?: { id: string; name: string }[];
  initialTraining?: Record<string, any>;
  editingTrainingId?: string;
}) {
  const editorFieldRef = useRef<HTMLDivElement>(null);
  const editorSnapshotRef = useRef<Block | null>(null);
  const drawingDragRef = useRef<{ drawing: Exclude<SelectedDrawing, null>; pointIndex?: number; last: { x: number; y: number } } | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(makeBlocks);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PaletteAsset | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<SelectedDrawing>(null);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | null>(null);
  const [numberLines, setNumberLines] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [areaMode, setAreaMode] = useState(false);
  const [areaStyle, setAreaStyle] = useState<AreaStyle>("outline");
  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [dribbleMode, setDribbleMode] = useState(false);
  const [dribblePoints, setDribblePoints] = useState<{ x: number; y: number }[]>([]);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [drawColor, setDrawColor] = useState("#111111");
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [name, setName] = useState("Nieuwe training");
  const [team, setTeam] = useState(teamOptions[0]?.name ?? "");
  const [customTeam, setCustomTeam] = useState(false);
  const [date, setDate] = useState("");
  const [playerCount, setPlayerCount] = useState(15);
  const [keeperCount, setKeeperCount] = useState(2);
  const [trainers, setTrainers] = useState<string[]>(initialTrainer ? [initialTrainer] : []);
  const [themes, setThemes] = useState<string[]>([]);
  const [material, setMaterial] = useState("");
  const [status, setStatus] = useState("");
  const [clubId, setClubId] = useState(clubOptions[0]?.id ?? "");
  const [ageCategory, setAgeCategory] = useState("");
  const [personalTrainingId, setPersonalTrainingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const activeBlock = activeIndex === null ? null : blocks[activeIndex];
  const selectedItem = activeBlock?.items.find(item => item.id === selectedId) ?? null;
  const totalMinutes = blocks.reduce((sum, block) => sum + (block.active ? block.minutes : 0), 0);
  const clubLogoUrl = customTeam ? null : teamOptions.find(option => option.name === team)?.clubLogoUrl ?? null;
  const byColor = (families: readonly (readonly [string, string])[]) =>
    colors.flatMap(color => families.map(([file, label]) => ({
      src: path(`${file}${color.file}.png`), label: `${label} ${color.label}`
    })));
  const equipmentGroups = [
    { label: "Dummies & muren", assets: byColor([["Dummy", "Dummy"], ["Muur", "Muur"]]) },
    { label: "Ballen", assets: balls.map(([file, label]) => ({ src: path(file), label })) },
    { label: "Markeringen", assets: [
      ...byColor([["GroteKegel", "Grote kegel"], ["KleineKegel", "Kleine kegel"]]),
      ...byColor([["Kegel", "Kegel"], ["KegelStok", "Kegelstok"]]),
      ...byColor([["Potje", "Potje"], ["SchijfGroot", "Grote schijf"]]),
      ...byColor([["Schijfje", "Schijfje"]])
    ] },
    { label: "Coördinatie & hindernissen", assets: [
      ...byColor([["KortLL", "Korte ladder"], ["LangLL", "Lange ladder"]]),
      ...byColor([["DubbelLL", "Dubbele ladder"], ["HaagKlein", "Kleine horde"]]),
      ...byColor([["HaagMiddel", "Middel horde"], ["HaagHoog", "Grote horde"]]),
      ...byColor([["StepUpBank", "Step-up bank"], ["Hoepel", "Hoepel"]]),
      ...byColor([["Hex", "Hexagon"]])
    ] },
    { label: "Doelen & overig", assets: [
      ...byColor([["Coach", "Coach"]]),
      ...otherEquipment.map(([file, label]) => ({ src: path(file), label }))
    ] }
  ];

  useEffect(() => {
    const raw = window.localStorage.getItem("cbcs.training-builder.v2");
    if (!raw && !initialTraining) return;
    try {
      const draft = initialTraining ?? JSON.parse(raw!);
      setName(draft.name ?? name); setTeam(draft.team ?? ""); setDate(draft.date ?? "");
      setPlayerCount(draft.playerCount ?? 15); setKeeperCount(draft.keeperCount ?? 2);
      setTrainers(Array.isArray(draft.trainers) ? draft.trainers : draft.trainer ? [draft.trainer] : initialTrainer ? [initialTrainer] : []);
      setThemes(Array.isArray(draft.themes) ? draft.themes : draft.theme ? [draft.theme] : []);
      setClubId(draft.clubId ?? clubOptions[0]?.id ?? "");
      setAgeCategory(draft.ageCategory ?? "");
      setPersonalTrainingId(draft.personalTrainingId);
      setCustomTeam(Boolean(draft.team && !teamOptions.some(option => option.name === draft.team)));
      setMaterial(draft.material ?? ""); if (Array.isArray(draft.blocks) && draft.blocks.length) {
        setBlocks(draft.blocks.map((block: Block, index: number) => ({
          ...block,
          id: block.id ?? `restored-phase-${index}`,
          code: block.id?.startsWith("default-phase-") ? "" : block.code,
          label: block.id?.startsWith("default-phase-") && phases[index]
            ? phases[index]
            : block.title?.trim() || block.label,
          title: "",
          lines: (block.lines ?? []).map(line => ({ ...line, color: line.color ?? "#111111" })),
          areas: (block.areas ?? []).map(area => ({ ...area, style: area.style ?? "fill" })),
          dribbles: block.dribbles ?? []
        })));
      } else {
        setBlocks(makeBlocks());
      }
      setStatus(initialTraining ? "Gedeelde training geopend · wijzigingen worden een nieuwe versie" : "Lokaal concept hersteld");
    } catch { /* een ongeldig oud concept negeren */ }
    // Alleen eenmalig het lokale concept herstellen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;
    const editorIndex = activeIndex;
    function cancelActiveTool(event: KeyboardEvent) {
      if (event.key === "Enter" && areaMode && areaPoints.length >= 3) {
        event.preventDefault();
        const area: FieldArea = {
          id: crypto.randomUUID(), points: areaPoints, color: drawColor, style: areaStyle,
          number: numberLines ? blocks[editorIndex].areas.filter(item => item.number).length + 1 : undefined
        };
        setBlocks(current => current.map((block, index) => index === editorIndex ? { ...block, areas: [...block.areas, area] } : block));
        setAreaPoints([]);
        setHoverPoint(null);
      } else if (event.key === "Enter" && dribbleMode && dribblePoints.length >= 2) {
        event.preventDefault();
        const dribble: FieldDribble = {
          id: crypto.randomUUID(), points: dribblePoints, color: drawColor
        };
        setBlocks(current => current.map((block, index) => index === editorIndex ? { ...block, dribbles: [...block.dribbles, dribble] } : block));
        setDribblePoints([]);
        setHoverPoint(null);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setSelectedAsset(null);
        setSelectedId(null);
        setSelectedDrawing(null);
        setLineStyle(null);
        setLineStart(null);
        setAreaMode(false);
        setAreaPoints([]);
        setDribbleMode(false);
        setDribblePoints([]);
        setHoverPoint(null);
      }
    }
    window.addEventListener("keydown", cancelActiveTool);
    return () => window.removeEventListener("keydown", cancelActiveTool);
  }, [activeIndex, areaMode, areaPoints, areaStyle, blocks, drawColor, dribbleMode, dribblePoints, numberLines]);

  useEffect(() => {
    if (!showPrintPreview) return;
    function closePrintPreview(event: KeyboardEvent) {
      if (event.key === "Escape") setShowPrintPreview(false);
    }
    window.addEventListener("keydown", closePrintPreview);
    return () => window.removeEventListener("keydown", closePrintPreview);
  }, [showPrintPreview]);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks(current => current.map((block, i) => i === index ? { ...block, ...patch } : block));
  }
  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks(current => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }
  function addBlock() {
    const nextNumber = blocks.length + 1;
    setBlocks(current => [...current, {
      id: crypto.randomUUID(),
      code: `VAK ${nextNumber}`,
      label: "Nieuwe trainingsvorm",
      active: true,
      title: "",
      minutes: 10,
      organisation: "",
      flow: "",
      coaching: "",
      items: [],
      lines: [],
      areas: [],
      dribbles: []
    }]);
  }
  function chooseAsset(asset: PaletteAsset) {
    setSelectedAsset(asset);
    setSelectedId(null);
    setSelectedDrawing(null);
    setLineStyle(null);
    setLineStart(null);
    setAreaMode(false);
    setAreaPoints([]);
    setDribbleMode(false);
    setDribblePoints([]);
  }
  function openEditor(index: number) {
    editorSnapshotRef.current = JSON.parse(JSON.stringify(blocks[index])) as Block;
    setActiveIndex(index);
    setSelectedId(null);
    setSelectedDrawing(null);
    setSelectedAsset(null);
    setLineStyle(null);
    setLineStart(null);
    setAreaMode(false);
    setAreaPoints([]);
    setDribbleMode(false);
    setDribblePoints([]);
    setConfirmClose(false);
  }
  function closeEditor(save: boolean) {
    if (!save && activeIndex !== null && editorSnapshotRef.current) {
      updateBlock(activeIndex, editorSnapshotRef.current);
    }
    setActiveIndex(null);
    setSelectedId(null);
    setSelectedDrawing(null);
    setConfirmClose(false);
    editorSnapshotRef.current = null;
  }
  async function saveDraft() {
    if (!clubId) return setStatus("Kies eerst de club waarvoor je bewaart.");
    if (!ageCategory) return setStatus("Kies verplicht een leeftijdsjaar.");
    if (!name.trim()) return setStatus("Geef de training eerst een naam.");
    setSaving(true);
    setStatus("Training bewaren…");
    window.localStorage.setItem("cbcs.training-builder.v2", JSON.stringify({
      version: 4, name, team, date, playerCount, keeperCount, trainers, themes, material, blocks,
      clubId, ageCategory, personalTrainingId, updatedAt: new Date().toISOString()
    }));
    try {
      const response = await fetch("/api/trainings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId, ageCategory, title: name, themes, personalTrainingId, clubTrainingId: editingTrainingId,
          content: { name, team, date, playerCount, keeperCount, trainers, themes, material, blocks }
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Bewaren is mislukt.");
      setPersonalTrainingId(result.personalTrainingId);
      window.localStorage.setItem("cbcs.training-builder.v2", JSON.stringify({
        version: 4, name, team, date, playerCount, keeperCount, trainers, themes, material, blocks,
        clubId, ageCategory, personalTrainingId: result.personalTrainingId, updatedAt: new Date().toISOString()
      }));
      const message = result.publicationState === "published"
        ? "Persoonlijk bewaard en automatisch gepubliceerd in Intradesk"
        : result.publicationState === "pending_approval"
          ? "Persoonlijk bewaard en naar de clubadmin gestuurd"
          : "Persoonlijk bewaard";
      setStatus(`${message} · ${ageCategory}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bewaren is mislukt.");
    } finally {
      setSaving(false);
    }
  }
  function placeItem(event: React.MouseEvent<HTMLDivElement>) {
    if (activeIndex === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (dribbleMode) {
      setDribblePoints(current => [...current, { x, y }]);
      return;
    }
    if (areaMode) {
      setAreaPoints(current => [...current, { x, y }]);
      return;
    }
    if (lineStyle) {
      if (!lineStart) {
        setLineStart({ x, y });
      } else {
        const line: FieldLine = {
          id: crypto.randomUUID(), x1: lineStart.x, y1: lineStart.y, x2: x, y2: y, style: lineStyle, color: drawColor,
          number: numberLines ? blocks[activeIndex].lines.filter(item => item.number).length + 1 : undefined
        };
        updateBlock(activeIndex, { lines: [...blocks[activeIndex].lines, line] });
        setLineStart(null);
      }
      return;
    }
    if (!selectedAsset) return;
    const isWall = selectedAsset.src.includes("/Muur");
    const isLadder = /\/(?:KortLL|LangLL|DubbelLL)/.test(selectedAsset.src);
    const isBigGoal = selectedAsset.src.includes("/Grote_goal");
    const isDevilsGoal = selectedAsset.src.includes("/Duivelsgoal");
    const item: FieldItem = {
      ...selectedAsset, id: crypto.randomUUID(), x, y, scale: isWall ? 1.5 : 1, rotation: 0,
      stretchX: isBigGoal ? 2.5 : isDevilsGoal ? 2 : 1, stretchY: isLadder ? 2 : 1
    };
    updateBlock(activeIndex, { items: [...blocks[activeIndex].items, item] });
    setSelectedId(item.id);
  }
  function moveItem(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null || !editorFieldRef.current) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100));
    updateBlock(activeIndex, { items: blocks[activeIndex].items.map(item => item.id === id ? { ...item, x, y } : item) });
  }
  function updateSelected(patch: Partial<FieldItem>) {
    if (activeIndex === null || !selectedId) return;
    updateBlock(activeIndex, { items: blocks[activeIndex].items.map(item => item.id === selectedId ? { ...item, ...patch } : item) });
  }
  function selectDrawing(drawing: Exclude<SelectedDrawing, null>) {
    setSelectedDrawing(drawing);
    setSelectedId(null);
    setSelectedAsset(null);
    setLineStyle(null);
    setLineStart(null);
    setAreaMode(false);
    setAreaPoints([]);
    setDribbleMode(false);
    setDribblePoints([]);
  }
  function resizeSelected(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null || !editorFieldRef.current) return;
    const item = blocks[activeIndex].items.find(candidate => candidate.id === id);
    if (!item) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width * item.x / 100;
    const cy = rect.top + rect.height * item.y / 100;
    const distance = Math.hypot(event.clientX - cx, event.clientY - cy);
    const baseSize = rect.width * .055 * Math.SQRT1_2;
    updateSelected({ scale: Math.max(.5, Math.min(3, distance / baseSize)) });
  }
  function rotateSelected(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null || !editorFieldRef.current) return;
    const item = blocks[activeIndex].items.find(candidate => candidate.id === id);
    if (!item) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width * item.x / 100;
    const cy = rect.top + rect.height * item.y / 100;
    const degrees = Math.round((Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI + 90) / 5) * 5;
    updateSelected({ rotation: degrees });
  }
  function deleteSelected() {
    if (activeIndex === null) return;
    if (selectedId) {
      updateBlock(activeIndex, { items: blocks[activeIndex].items.filter(item => item.id !== selectedId) });
      setSelectedId(null);
    } else if (selectedDrawing?.kind === "line") {
      updateBlock(activeIndex, { lines: blocks[activeIndex].lines.filter(line => line.id !== selectedDrawing.id) });
      setSelectedDrawing(null);
    } else if (selectedDrawing?.kind === "area") {
      updateBlock(activeIndex, { areas: blocks[activeIndex].areas.filter(area => area.id !== selectedDrawing.id) });
      setSelectedDrawing(null);
    } else if (selectedDrawing?.kind === "dribble") {
      updateBlock(activeIndex, { dribbles: blocks[activeIndex].dribbles.filter(dribble => dribble.id !== selectedDrawing.id) });
      setSelectedDrawing(null);
    }
  }
  function deleteFieldItem(id: string) {
    if (activeIndex === null) return;
    updateBlock(activeIndex, { items: blocks[activeIndex].items.filter(item => item.id !== id) });
    setSelectedId(null);
  }
  function drawingPoint(event: React.PointerEvent<SVGElement>) {
    if (!editorFieldRef.current) return null;
    const rect = editorFieldRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    };
  }
  function startDrawingDrag(event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) {
    const point = drawingPoint(event);
    if (!point) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingDragRef.current = { drawing, pointIndex, last: point };
    selectDrawing(drawing);
  }
  function moveDrawingDrag(event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) {
    const drag = drawingDragRef.current;
    if (!drag || drag.drawing.id !== drawing.id || !event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null) return;
    const point = drawingPoint(event);
    if (!point) return;
    event.stopPropagation();
    const dx = point.x - drag.last.x;
    const dy = point.y - drag.last.y;
    const movePoints = (points: { x: number; y: number }[]) =>
      pointIndex === undefined ? points.map(value => ({ x: value.x + dx, y: value.y + dy })) : points.map((value, index) => index === pointIndex ? point : value);
    if (drawing.kind === "line") {
      updateBlock(activeIndex, { lines: blocks[activeIndex].lines.map(line => line.id !== drawing.id ? line : pointIndex === 0 ? { ...line, x1: point.x, y1: point.y } : pointIndex === 1 ? { ...line, x2: point.x, y2: point.y } : { ...line, x1: line.x1 + dx, y1: line.y1 + dy, x2: line.x2 + dx, y2: line.y2 + dy }) });
    } else if (drawing.kind === "area") {
      updateBlock(activeIndex, { areas: blocks[activeIndex].areas.map(area => area.id === drawing.id ? { ...area, points: movePoints(area.points) } : area) });
    } else {
      updateBlock(activeIndex, { dribbles: blocks[activeIndex].dribbles.map(dribble => dribble.id === drawing.id ? { ...dribble, points: movePoints(dribble.points) } : dribble) });
    }
    drag.last = point;
  }
  function trackDrawingPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!lineStart && areaPoints.length === 0 && dribblePoints.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPoint({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    });
  }
  function finishArea() {
    if (activeIndex === null || areaPoints.length < 3) return;
    const area: FieldArea = {
      id: crypto.randomUUID(), points: areaPoints, color: drawColor, style: areaStyle,
      number: numberLines ? blocks[activeIndex].areas.filter(item => item.number).length + 1 : undefined
    };
    updateBlock(activeIndex, { areas: [...blocks[activeIndex].areas, area] });
    setAreaPoints([]);
    setHoverPoint(null);
  }
  function finishDribble() {
    if (activeIndex === null || dribblePoints.length < 2) return;
    const dribble: FieldDribble = {
      id: crypto.randomUUID(), points: dribblePoints, color: drawColor
    };
    updateBlock(activeIndex, { dribbles: [...blocks[activeIndex].dribbles, dribble] });
    setDribblePoints([]);
    setHoverPoint(null);
  }

  const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm normal-case text-textBright outline-none focus:border-accent";
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Meta label="Naam training"><input value={name} onChange={e => setName(e.target.value)} className={inputClass} /></Meta>
          <Meta label="Leeftijdsjaar *">
            <select required value={ageCategory} onChange={event => setAgeCategory(event.target.value)} className={inputClass}>
              <option value="">Kies leeftijdsjaar…</option>
              {TRAINING_AGE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </Meta>
          {clubOptions.length > 1 && <Meta label="Club">
            <select value={clubId} onChange={event => setClubId(event.target.value)} className={inputClass}>
              {clubOptions.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </Meta>}
          <Meta label="Ploeg">
            <select value={customTeam ? "__custom__" : team} onChange={event => {
              const value = event.target.value;
              setCustomTeam(value === "__custom__");
              setTeam(value === "__custom__" ? "" : value);
            }} className={inputClass}>
              {!teamOptions.length && <option value="">Geen clubploegen gevonden</option>}
              {teamOptions.map(option => <option key={option.id} value={option.name}>{option.name}{option.assigned ? " · toegewezen" : ""}</option>)}
              <option value="__custom__">Andere ploeg typen…</option>
            </select>
            {customTeam && <input autoFocus value={team} onChange={event => setTeam(event.target.value)} placeholder="Naam van de ploeg" className={inputClass} />}
          </Meta>
          <Meta label="Datum"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} /></Meta>
          <Meta label="Aantal spelers">
            <div className="mt-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1">
              <input aria-label="Veldspelers" type="number" min={0} value={playerCount} onChange={e => setPlayerCount(Number(e.target.value))} className={inputClass.replace("mt-1 ", "")} />
              <span className="text-sm font-bold text-textMuted">+</span>
              <input aria-label="Keepers" type="number" min={0} value={keeperCount} onChange={e => setKeeperCount(Number(e.target.value))} className={inputClass.replace("mt-1 ", "")} />
              <span className="text-xs text-textMuted">K</span>
            </div>
          </Meta>
          <Meta label="Trainer(s)"><MultiValueInput values={trainers} onChange={setTrainers} suggestions={trainerOptions} placeholder="Trainer toevoegen" /></Meta>
          <Meta label="Hoofdthema('s)"><MultiValueInput values={themes} onChange={setThemes} placeholder="Thema toevoegen" /></Meta>
        </div>
        <Meta label="Benodigd materiaal volledige training" wide>
          <textarea value={material} onChange={e => setMaterial(e.target.value)} rows={2} className={inputClass} placeholder="Ballen, potjes, hesjes, doelen…" />
        </Meta>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-textSecondary">{status}</span>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-accentDim px-4 py-2 text-sm font-black text-accent">Totale duur: {totalMinutes} minuten</span>
            <button type="button" onClick={() => setShowPrintPreview(true)} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-bold text-textPrimary">Afdrukvoorbeeld</button>
            <button type="button" disabled={saving} onClick={() => void saveDraft()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page disabled:opacity-50">
              {saving ? "Opslaan…" : editingTrainingId ? "Nieuwe versie opslaan" : "Opslaan"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {blocks.map((block, index) => (
          <article key={block.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input value={block.label} onChange={event => updateBlock(index, { label: event.target.value })}
                  aria-label="Naam trainingsvak" className="min-w-48 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-2 font-bold text-textBright outline-none hover:border-border focus:border-accent focus:bg-input" />
              </div>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-textSecondary">
                  <input type="number" min={0} value={block.minutes} onChange={event => updateBlock(index, { minutes: Number(event.target.value) })}
                    aria-label={`Minuten ${block.label}`} className="w-20 rounded border border-border bg-input px-3 py-1.5 text-right text-sm text-textBright outline-none focus:border-accent" />
                  min.
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} title="Vak omhoog" aria-label="Trainingsvak omhoog"
                    className="grid h-8 w-8 place-items-center rounded border border-borderButton bg-button text-sm font-black text-textPrimary disabled:cursor-not-allowed disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} title="Vak omlaag" aria-label="Trainingsvak omlaag"
                    className="grid h-8 w-8 place-items-center rounded border border-borderButton bg-button text-sm font-black text-textPrimary disabled:cursor-not-allowed disabled:opacity-30">↓</button>
                </div>
                <label className="flex items-center gap-2 text-xs text-textSecondary"><input type="checkbox" checked={block.active} onChange={e => updateBlock(index, { active: e.target.checked })} /> actief</label>
              </div>
            </header>
            <div className="grid gap-5 p-4 lg:grid-cols-[300px_1fr]">
              <div>
                <button type="button" onClick={() => openEditor(index)}
                  className="block w-full overflow-hidden rounded-xl border border-border bg-white hover:border-accent" title="Open tekentool">
                  <Pitch items={block.items} lines={block.lines} areas={block.areas} dribbles={block.dribbles} preview />
                </button>
                <button type="button" onClick={() => openEditor(index)}
                  className="mt-2 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-page">Tekenen</button>
              </div>
              <div className="grid content-start gap-3">
                <Meta label="Organisatie" wide><textarea value={block.organisation} onChange={e => updateBlock(index, { organisation: e.target.value })} rows={3} className={inputClass} /></Meta>
                <Meta label="Verloop" wide><textarea value={block.flow} onChange={e => updateBlock(index, { flow: e.target.value })} rows={3} className={inputClass} /></Meta>
                <Meta label="Coaching" wide><textarea value={block.coaching} onChange={e => updateBlock(index, { coaching: e.target.value })} rows={3} className={inputClass} /></Meta>
              </div>
            </div>
          </article>
        ))}
        <button type="button" onClick={addBlock}
          className="w-full rounded-2xl border-2 border-dashed border-accent/60 bg-accentDim/30 px-5 py-5 text-sm font-black text-accent hover:border-accent hover:bg-accentDim">
          + Trainingsvak toevoegen
        </button>
      </section>

      {showPrintPreview && <PrintPreview name={name} team={team} clubLogoUrl={clubLogoUrl} date={date} playerCount={playerCount} keeperCount={keeperCount}
        trainers={trainers} themes={themes} material={material} blocks={blocks} onClose={() => setShowPrintPreview(false)} />}

      {activeBlock && activeIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={`Tekening ${activeBlock.label}`}>
          <div className="flex max-h-[97vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-[#101713] px-4 py-3 text-white">
              <div><strong>Tekentool · {activeBlock.label}</strong><p className="text-xs text-white/60">Kies een icoon en klik op het veld. Sleep om te verplaatsen.</p></div>
              <button type="button" onClick={() => setConfirmClose(true)} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">Sluiten</button>
            </header>
            <div className="grid min-h-0 flex-1 gap-3 overflow-auto bg-white p-3 lg:grid-cols-[430px_1fr]">
              <aside className="space-y-2 overflow-auto lg:max-h-[78vh]">
                {playerFamilies.map(family => <PlayerGroup key={family.file} family={family} onPick={chooseAsset} activeSrc={selectedAsset?.src} />)}
                {equipmentGroups.map(group => (
                  <section key={group.label} className="rounded-lg border border-[#dbe2de] bg-white p-2">
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#243029]">{group.label}</h3>
                    <div className="grid grid-cols-10 gap-1">
                      {group.assets.map(asset => <AssetButton key={asset.src} asset={asset} onPick={chooseAsset} active={selectedAsset?.src === asset.src} />)}
                    </div>
                  </section>
                ))}
              </aside>
              <main className="min-w-0">
                <div className="mx-auto mb-3 flex max-w-[940px] flex-wrap items-center gap-2 rounded-lg border border-[#dbe2de] bg-[#f7f9f8] p-2 text-[#182019]">
                  <button type="button" onClick={() => { setLineStyle(null); setLineStart(null); setAreaMode(false); setAreaPoints([]); setDribbleMode(false); setDribblePoints([]); setSelectedDrawing(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${!lineStyle && !areaMode && !dribbleMode ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>↖ Selecteren</button>
                  <button type="button" onClick={() => { setLineStyle("solid"); setAreaMode(false); setAreaPoints([]); setDribbleMode(false); setDribblePoints([]); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setLineStart(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${lineStyle === "solid" ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>→ Pass</button>
                  <button type="button" onClick={() => { setLineStyle("dashed"); setAreaMode(false); setAreaPoints([]); setDribbleMode(false); setDribblePoints([]); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setLineStart(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${lineStyle === "dashed" ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>⇢ Looplijn</button>
                  <button type="button" onClick={() => { setDribbleMode(true); setDribblePoints([]); setAreaMode(false); setAreaPoints([]); setLineStyle(null); setLineStart(null); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${dribbleMode ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>〰 Dribbel</button>
                  <button type="button" onClick={() => { setAreaMode(true); setDribbleMode(false); setDribblePoints([]); setLineStyle(null); setLineStart(null); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setAreaPoints([]); }} className={`rounded border px-3 py-2 text-xs font-bold ${areaMode ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>▱ Area</button>
                  <label className="flex items-center gap-2 rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold"><input type="checkbox" checked={numberLines} onChange={e => setNumberLines(e.target.checked)} /> Pijlen & Areas nummeren</label>
                  <button type="button" onClick={() => setShowColorPanel(value => !value)} className="flex items-center gap-2 rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold">
                    <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: drawColor }} /> Kleur ▾
                  </button>
                  {areaMode && areaPoints.length >= 3 && <button type="button" onClick={finishArea} className="rounded bg-[#169447] px-3 py-2 text-xs font-bold text-white">Area voltooien</button>}
                  {dribbleMode && dribblePoints.length >= 2 && <button type="button" onClick={finishDribble} className="rounded bg-[#169447] px-3 py-2 text-xs font-bold text-white">Dribbel voltooien</button>}
                  {selectedDrawing && <button type="button" onClick={deleteSelected} className="rounded bg-[#9f2525] px-3 py-2 text-xs font-bold text-white">Selectie verwijderen</button>}
                  <button type="button" onClick={() => { updateBlock(activeIndex, { items: [], lines: [], areas: [], dribbles: [] }); setSelectedId(null); setSelectedDrawing(null); setLineStart(null); setAreaPoints([]); setDribblePoints([]); }} className="ml-auto rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold">Alles wissen</button>
                  {areaMode && <div className="basis-full rounded-md border border-[#cbd5cf] bg-white p-2">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#66706b]">Area-weergave</p>
                    <div className="flex flex-wrap gap-2">
                      {([["outline", "Leeg"], ["fill", "Lichte fill"], ["hatched", "Arcering"]] as const).map(([value, label]) =>
                        <button key={value} type="button" onClick={() => setAreaStyle(value)} className={`rounded border px-3 py-2 text-xs font-bold ${areaStyle === value ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf]"}`}>{label}</button>)}
                    </div>
                  </div>}
                  {showColorPanel && <div className="basis-full rounded-md border border-[#cbd5cf] bg-white p-2">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#66706b]">Tekenkleur</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {["#111111", "#4b5563", "#ffffff", "#e53935", "#fb7185", "#f59e0b", "#facc15", "#65a30d", "#169447", "#14b8a6", "#06b6d4", "#1565c0", "#6366f1", "#7c3aed", "#c026d3", "#92400e"].map(color => (
                        <button key={color} type="button" aria-label={`Kleur ${color}`} onClick={() => { setDrawColor(color); setShowColorPanel(false); }}
                          style={{ backgroundColor: color }} className={`h-7 w-7 rounded-full border ${drawColor === color ? "ring-2 ring-[#169447] ring-offset-2" : ""}`} />
                      ))}
                      <label className="ml-2 flex items-center gap-2 text-xs font-bold">Hex
                        <input value={drawColor} onChange={event => /^#[0-9a-fA-F]{0,6}$/.test(event.target.value) && setDrawColor(event.target.value)} className="w-24 rounded border border-[#cbd5cf] px-2 py-1.5 font-mono text-xs" />
                      </label>
                    </div>
                  </div>}
                  <p className="basis-full px-1 text-[11px] text-[#66706b]">
                    {dribbleMode ? (dribblePoints.length < 2 ? `Klik minstens 2 punten voor de dribbel (${dribblePoints.length}/2).` : `${dribblePoints.length} punten · blijf klikken of voltooi met de knop/Enter.`) : areaMode ? (areaPoints.length < 3 ? `Klik minstens 3 hoekpunten voor de Area (${areaPoints.length}/3).` : `${areaPoints.length} punten · klik “Area voltooien” of druk Enter.`) : lineStyle ? (lineStart ? "Beweeg de cursor en klik het eindpunt van de pijl." : "Klik het startpunt van de pijl.") : selectedItem ? "Sleep het groene bolletje om te schalen en ↻ om te draaien." : selectedAsset ? `Actief: ${selectedAsset.label} · Escape annuleert.` : "Kies links een icoon, beweging of Area. Escape annuleert de actieve tool."}
                  </p>
                </div>
                <div ref={editorFieldRef} onClick={placeItem} onPointerMove={trackDrawingPointer} onPointerLeave={() => setHoverPoint(null)} className="mx-auto w-full max-w-[620px] self-start overflow-hidden rounded border border-[#dbe2de] bg-white shadow-sm">
                  <Pitch items={activeBlock.items} lines={activeBlock.lines} areas={activeBlock.areas} dribbles={activeBlock.dribbles} selectedId={selectedId} selectedDrawing={selectedDrawing}
                    drawingInteractive={!selectedAsset && !lineStyle && !areaMode && !dribbleMode}
                    onSelect={id => { setSelectedId(id); setSelectedDrawing(null); }} onDeleteItem={deleteFieldItem}
                    onSelectDrawing={selectDrawing} onDrawingPointerDown={startDrawingDrag} onDrawingPointerMove={moveDrawingDrag}
                    onMove={moveItem} onResize={resizeSelected} onRotate={rotateSelected} pendingLine={lineStart}
                    pendingLineStyle={lineStyle} pendingArea={areaPoints} pendingAreaStyle={areaStyle} pendingDribble={dribblePoints}
                    hoverPoint={hoverPoint} drawingColor={drawColor} />
                </div>
              </main>
            </div>
            <footer className="flex justify-end border-t border-[#dbe2de] bg-white px-4 py-3">
              <button type="button" onClick={() => closeEditor(true)} className="rounded-lg bg-[#169447] px-5 py-2.5 text-sm font-black text-white">Tekening opslaan</button>
            </footer>
          </div>
          {confirmClose && <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 text-[#182019] shadow-2xl">
              <h3 className="text-lg font-black">Tekening opslaan?</h3>
              <p className="mt-2 text-sm text-[#66706b]">Wil je de wijzigingen aan deze tekening bewaren voordat je sluit?</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmClose(false)} className="rounded-lg border border-[#cbd5cf] px-4 py-2 text-sm font-bold">Annuleren</button>
                <button type="button" onClick={() => closeEditor(false)} className="rounded-lg border border-[#b43b3b] px-4 py-2 text-sm font-bold text-[#9f2525]">Niet opslaan</button>
                <button type="button" onClick={() => closeEditor(true)} className="rounded-lg bg-[#169447] px-4 py-2 text-sm font-black text-white">Opslaan</button>
              </div>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}

function Meta({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`${wide ? "mt-3 block sm:col-span-2" : "block"} text-xs font-bold uppercase tracking-wide text-textMuted`}>{label}{children}</label>;
}
