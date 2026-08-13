"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { GREEN_FIELD_SRC } from "@/components/training/constants";

export type LineupPosition = { playerId: string; x: number; y: number; placed?: boolean; positionId?: string };
export type LineupBlock = { id: string; startMinute: number; positions: LineupPosition[] };

type Player = { id: string; first_name: string; last_name: string; jersey_number: number | null; is_goalkeeper?: boolean };
type PositionSlot = { id: string; short: string; label: string; x: number; y: number };

const SHIRT_SRC = "/branding/Training/shirt-groen.png";
const GOALKEEPER_SHIRT_SRC = "/branding/Training/shirt-rood.png";
const X = [12, 31, 50, 69, 88];
const POSITION_SLOTS: PositionSlot[] = [
  { id: "lw", short: "LB", label: "Linksbuiten", x: X[0], y: 14 },
  { id: "ls", short: "LS", label: "Linkse spits", x: X[1], y: 14 },
  { id: "sp", short: "SP", label: "Centrale spits", x: X[2], y: 14 },
  { id: "rs", short: "RS", label: "Rechtse spits", x: X[3], y: 14 },
  { id: "rw", short: "RB", label: "Rechtsbuiten", x: X[4], y: 14 },
  { id: "lam", short: "LAM", label: "Linkse aanvallende middenvelder", x: X[0], y: 31 },
  { id: "lcam", short: "LCAM", label: "Links-centraal aanvallende middenvelder", x: X[1], y: 31 },
  { id: "cam", short: "CAM", label: "Centrale aanvallende middenvelder", x: X[2], y: 31 },
  { id: "rcam", short: "RCAM", label: "Rechts-centraal aanvallende middenvelder", x: X[3], y: 31 },
  { id: "ram", short: "RAM", label: "Rechtse aanvallende middenvelder", x: X[4], y: 31 },
  { id: "lm", short: "LM", label: "Linkse middenvelder", x: X[0], y: 48 },
  { id: "lcm", short: "LCM", label: "Linkse centrale middenvelder", x: X[1], y: 48 },
  { id: "cm", short: "CM", label: "Centrale middenvelder", x: X[2], y: 48 },
  { id: "rcm", short: "RCM", label: "Rechtse centrale middenvelder", x: X[3], y: 48 },
  { id: "rm", short: "RM", label: "Rechtse middenvelder", x: X[4], y: 48 },
  { id: "ldm", short: "LVM", label: "Linkse verdedigende middenvelder", x: X[0], y: 65 },
  { id: "lcdm", short: "LCVM", label: "Links-centraal verdedigende middenvelder", x: X[1], y: 65 },
  { id: "cdm", short: "CVM", label: "Centrale verdedigende middenvelder", x: X[2], y: 65 },
  { id: "rcdm", short: "RCVM", label: "Rechts-centraal verdedigende middenvelder", x: X[3], y: 65 },
  { id: "rdm", short: "RVM", label: "Rechtse verdedigende middenvelder", x: X[4], y: 65 },
  { id: "lb", short: "LV", label: "Linksachter", x: X[0], y: 81 },
  { id: "lcb", short: "LCV", label: "Linkse centrale verdediger", x: X[1], y: 81 },
  { id: "cb", short: "CV", label: "Centrale verdediger", x: X[2], y: 81 },
  { id: "rcb", short: "RCV", label: "Rechtse centrale verdediger", x: X[3], y: 81 },
  { id: "rb", short: "RV", label: "Rechtsachter", x: X[4], y: 81 },
  { id: "gk", short: "DM", label: "Doelman", x: 50, y: 94 }
];

function closestSlot(x: number, y: number) {
  return POSITION_SLOTS.reduce((closest, slot) =>
    Math.hypot(slot.x - x, slot.y - y) < Math.hypot(closest.x - x, closest.y - y) ? slot : closest
  );
}

export function MatchLineupEditor({ players, blocks, editable, onChange }: {
  players: Player[]; blocks: LineupBlock[]; editable: boolean; onChange: (blocks: LineupBlock[]) => void;
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [activeBlockId, setActiveBlockId] = useState(blocks[0]?.id ?? "block-0");
  const [newMinute, setNewMinute] = useState("");
  const [draggingPlayerId, setDraggingPlayerId] = useState("");
  const orderedBlocks = useMemo(() => [...blocks].sort((a, b) => a.startMinute - b.startMinute), [blocks]);
  const activeBlock = orderedBlocks.find(block => block.id === activeBlockId) ?? orderedBlocks[0];
  const positions = activeBlock?.positions ?? [];

  function playerName(player: Player) { return `${player.first_name} ${player.last_name}`.trim(); }
  function slotFor(position: LineupPosition) { return POSITION_SLOTS.find(slot => slot.id === position.positionId) ?? closestSlot(position.x, position.y); }

  function assignPlayer(playerId: string, clientX: number, clientY: number) {
    if (!editable || !activeBlock) return;
    const bounds = pitchRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const y = ((clientY - bounds.top) / bounds.height) * 100;
    const slot = closestSlot(x, y);
    const next = positions.filter(position => position.playerId !== playerId && slotFor(position).id !== slot.id);
    next.push({ playerId, positionId: slot.id, x: slot.x, y: slot.y, placed: true });
    onChange(blocks.map(block => block.id === activeBlock.id ? { ...block, positions: next } : block));
  }

  function removePlayer(playerId: string) {
    if (!activeBlock) return;
    onChange(blocks.map(block => block.id === activeBlock.id ? { ...block, positions: positions.filter(item => item.playerId !== playerId) } : block));
  }

  function addBlock() {
    const minute = Number(newMinute);
    if (!activeBlock || !Number.isInteger(minute) || minute < 1 || minute > 120 || blocks.some(block => block.startMinute === minute)) return;
    const block: LineupBlock = { id: crypto.randomUUID(), startMinute: minute, positions: positions.map(position => ({ ...position })) };
    onChange([...blocks, block]); setActiveBlockId(block.id); setNewMinute("");
  }

  function copyPreviousBlock() {
    if (!activeBlock) return;
    const previous = orderedBlocks.filter(block => block.startMinute < activeBlock.startMinute).at(-1);
    if (!previous) return;
    onChange(blocks.map(block => block.id === activeBlock.id ? { ...block, positions: previous.positions.map(position => ({ ...position })) } : block));
  }

  if (!players.length) return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-textMuted">Er zijn nog geen spelers aan deze wedstrijd of ploeg gekoppeld.</p>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borderSubtle bg-cardDeep p-3">
      <strong className="mr-1 text-xs uppercase tracking-wide text-textMuted">Opstellingsblokken</strong>
      {orderedBlocks.map((block, index) => <button key={block.id} type="button" onClick={() => setActiveBlockId(block.id)} className={`rounded-lg px-3 py-2 text-sm font-bold ${activeBlock?.id === block.id ? "bg-accent text-page" : "border border-borderButton text-textPrimary"}`}>
        {index === 0 && block.startMinute === 0 ? "Start" : `Vanaf ${block.startMinute}'`}
      </button>)}
      {editable && <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-bold text-textSecondary">Nieuw blok vanaf minuut
          <input type="number" min={1} max={120} value={newMinute} onChange={event => setNewMinute(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addBlock(); } }} className="w-20 rounded-lg border border-border bg-input px-2 py-2 text-textPrimary" />
        </label>
        <button type="button" onClick={addBlock} disabled={!newMinute} className="rounded-lg bg-accent px-3 py-2 text-sm font-black text-page disabled:opacity-40">Blok toevoegen</button>
      </div>}
    </div>

    {editable && activeBlock && activeBlock.startMinute > 0 && <div className="flex justify-end"><button type="button" onClick={copyPreviousBlock} className="rounded-lg border border-accent px-3 py-2 text-sm font-bold text-accent">Selectie van vorig blok kopiëren</button></div>}

    <div className={`grid items-start gap-5 ${editable ? "lg:grid-cols-[minmax(360px,620px)_minmax(230px,1fr)]" : "lg:grid-cols-[minmax(300px,430px)_minmax(230px,1fr)]"}`}>
      <div className={`w-full ${editable ? "max-w-[620px]" : "max-w-[430px]"}`}>
        <div ref={pitchRef} className="relative aspect-[414/612] w-full overflow-hidden rounded-xl border border-white/20 bg-[#269c36] shadow-inner"
          onDragOver={event => { if (editable) event.preventDefault(); }} onDrop={event => { event.preventDefault(); assignPlayer(event.dataTransfer.getData("text/player-id"), event.clientX, event.clientY); }} aria-label="Voetbalveld met vaste posities">
          <Image src={GREEN_FIELD_SRC} alt="Voetbalveld" fill sizes="620px" className="pointer-events-none object-fill" priority={false} />
          {POSITION_SLOTS.map(slot => {
            const assignment = positions.find(position => slotFor(position).id === slot.id);
            const player = assignment ? players.find(item => item.id === assignment.playerId) : null;
            return <div key={slot.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} title={player ? slot.label : undefined}>
              {player && <div className="relative h-10 w-10 opacity-100 sm:h-12 sm:w-12">
                <Image src={player.is_goalkeeper ? GOALKEEPER_SHIRT_SRC : SHIRT_SRC} alt="" fill sizes="48px" className="object-contain" />
                <span className="absolute inset-0 flex items-center justify-center pt-1 text-[10px] font-black text-white drop-shadow">{player.jersey_number ?? ""}</span>
              </div>}
              {player ? <button type="button" draggable={editable} disabled={!editable} onDragStart={event => { setDraggingPlayerId(player.id); event.dataTransfer.setData("text/player-id", player.id); }} onDragEnd={() => setDraggingPlayerId("")}
                onDoubleClick={() => editable && removePlayer(player.id)} className={`absolute inset-0 h-full w-full ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`} aria-label={`${playerName(player)} op ${slot.label}`} /> : null}
              {player && <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 py-0.5 text-[8px] font-bold text-white">{playerName(player)}</span>}
            </div>;
          })}
        </div>
        {editable && <p className="mt-2 text-xs text-textMuted">Sleep een speler uit de lijst naar de gewenste plaats op het veld. Dubbelklik op een geplaatste speler om hem van het veld te halen.</p>}
      </div>

      <aside className="rounded-xl border border-borderSubtle bg-cardDeep p-3 lg:sticky lg:top-24">
        <div className="flex items-center justify-between gap-2"><strong className="text-xs uppercase tracking-wide text-textMuted">Spelerslijst</strong><span className="text-xs text-textMuted">{players.length}</span></div>
        <div className="mt-3 max-h-[760px] space-y-1.5 overflow-y-auto pr-1">
          {players.map(player => {
            const assignment = positions.find(position => position.playerId === player.id);
            const slot = assignment ? slotFor(assignment) : null;
            return <button key={player.id} type="button" draggable={editable} disabled={!editable} onDragStart={event => { setDraggingPlayerId(player.id); event.dataTransfer.setData("text/player-id", player.id); }} onDragEnd={() => setDraggingPlayerId("")}
              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${assignment ? "border-accent/40 bg-accentDim" : "border-borderSubtle bg-card"} ${draggingPlayerId === player.id ? "opacity-50" : ""} disabled:cursor-default`}>
              <span className="relative h-9 w-9 shrink-0"><Image src={player.is_goalkeeper ? GOALKEEPER_SHIRT_SRC : SHIRT_SRC} alt="" fill sizes="36px" className="object-contain" /><span className="absolute inset-0 flex items-center justify-center pt-1 text-[10px] font-black text-white">{player.jersey_number ?? ""}</span></span>
              <span className="min-w-0"><strong className="block truncate text-sm text-textBright">{playerName(player)}</strong><small className="block truncate text-textMuted">{slot?.label ?? "Nog niet opgesteld"}</small></span>
            </button>;
          })}
        </div>
      </aside>
    </div>

    {editable && activeBlock && activeBlock.startMinute > 0 && <div className="flex justify-end"><button type="button" onClick={() => { const remaining = blocks.filter(block => block.id !== activeBlock.id); onChange(remaining); setActiveBlockId(remaining[0]?.id ?? "block-0"); }} className="rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-300">Dit blok verwijderen</button></div>}
  </div>;
}
