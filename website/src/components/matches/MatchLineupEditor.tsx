"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { GREEN_FIELD_SRC } from "@/components/training/constants";

export type LineupPosition = { playerId: string; x: number; y: number; placed?: boolean };
export type LineupBlock = { id: string; startMinute: number; positions: LineupPosition[] };

type Player = { id: string; first_name: string; last_name: string; jersey_number: number | null };

function initialPosition(playerId: string, index: number, total: number): LineupPosition {
  const columns = total > 18 ? 4 : total > 10 ? 3 : 2;
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    playerId,
    x: 10 + column * (80 / Math.max(1, columns - 1)),
    y: 9 + row * (82 / Math.max(1, rows - 1)),
    placed: false
  };
}

export function MatchLineupEditor({ players, blocks, editable, onChange }: {
  players: Player[];
  blocks: LineupBlock[];
  editable: boolean;
  onChange: (blocks: LineupBlock[]) => void;
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [activeBlockId, setActiveBlockId] = useState(blocks[0]?.id ?? "block-0");
  const [newMinute, setNewMinute] = useState("");
  const [draggingPlayerId, setDraggingPlayerId] = useState("");
  const orderedBlocks = useMemo(() => [...blocks].sort((a, b) => a.startMinute - b.startMinute), [blocks]);
  const activeBlock = orderedBlocks.find(block => block.id === activeBlockId) ?? orderedBlocks[0];
  const visiblePositions = players.map((player, index) =>
    activeBlock?.positions.find(position => position.playerId === player.id) ?? initialPosition(player.id, index, players.length)
  );

  function playerName(player: Player) {
    return `${player.first_name} ${player.last_name}`.trim();
  }

  function movePlayer(playerId: string, clientX: number, clientY: number, placed = true) {
    if (!editable || !activeBlock) return;
    const bounds = pitchRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const position: LineupPosition = {
      playerId,
      x: Math.max(4, Math.min(96, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(4, Math.min(96, ((clientY - bounds.top) / bounds.height) * 100)),
      placed
    };
    onChange(blocks.map(block => block.id === activeBlock.id
      ? { ...block, positions: [...block.positions.filter(item => item.playerId !== playerId), position] }
      : block));
  }

  function addBlock() {
    const minute = Number(newMinute);
    if (!activeBlock || !Number.isInteger(minute) || minute < 1 || minute > 120 || blocks.some(block => block.startMinute === minute)) return;
    const block: LineupBlock = {
      id: crypto.randomUUID(),
      startMinute: minute,
      positions: visiblePositions.map(position => ({ ...position }))
    };
    onChange([...blocks, block]);
    setActiveBlockId(block.id);
    setNewMinute("");
  }

  if (!players.length) return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-textMuted">
    Er zijn nog geen spelers aan deze wedstrijd of ploeg gekoppeld.
  </p>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borderSubtle bg-cardDeep p-3">
      <strong className="mr-1 text-xs uppercase tracking-wide text-textMuted">Opstellingsblokken</strong>
      {orderedBlocks.map((block, index) => <button key={block.id} type="button" onClick={() => setActiveBlockId(block.id)}
        className={`rounded-lg px-3 py-2 text-sm font-bold ${activeBlock?.id === block.id ? "bg-accent text-page" : "border border-borderButton text-textPrimary"}`}>
        {index === 0 && block.startMinute === 0 ? "Start" : `Vanaf ${block.startMinute}'`}
      </button>)}
      {editable && <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-bold text-textSecondary">Nieuwe wissel vanaf minuut
          <input type="number" min={1} max={120} value={newMinute} onChange={event => setNewMinute(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addBlock(); } }}
            className="w-20 rounded-lg border border-border bg-input px-2 py-2 text-textPrimary" />
        </label>
        <button type="button" onClick={addBlock} disabled={!newMinute} className="rounded-lg bg-accent px-3 py-2 text-sm font-black text-page disabled:opacity-40">Blok toevoegen</button>
      </div>}
    </div>

    <div className="mx-auto w-full max-w-[620px]">
      <div ref={pitchRef} className="relative aspect-[414/612] w-full touch-none overflow-hidden rounded-xl border border-white/20 bg-[#269c36] shadow-inner" aria-label="Voetbalveld met opstelling">
        <Image src={GREEN_FIELD_SRC} alt="Voetbalveld" fill sizes="620px" className="pointer-events-none object-fill" priority={false} />
        {visiblePositions.map(position => {
          const player = players.find(item => item.id === position.playerId);
          if (!player) return null;
          const isDragging = draggingPlayerId === player.id;
          return <button key={player.id} type="button" disabled={!editable}
            onPointerDown={event => {
              if (!editable) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDraggingPlayerId(player.id);
            }}
            onPointerMove={event => { if (draggingPlayerId === player.id) movePlayer(player.id, event.clientX, event.clientY); }}
            onPointerUp={event => {
              if (draggingPlayerId === player.id) movePlayer(player.id, event.clientX, event.clientY);
              setDraggingPlayerId("");
            }}
            onPointerCancel={() => setDraggingPlayerId("")}
            title={`${playerName(player)}${editable ? " verslepen" : ""}`}
            className={`absolute z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-accent text-xs font-black text-page shadow-lg transition-opacity sm:h-12 sm:w-12 ${position.placed === false ? "opacity-40" : "opacity-100"} ${isDragging ? "z-20 scale-110 cursor-grabbing" : editable ? "cursor-grab" : "cursor-default"}`}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}>
            {player.jersey_number ?? player.first_name.slice(0, 2).toUpperCase()}
            <span className="pointer-events-none absolute top-full mt-0.5 max-w-24 truncate rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-white">{playerName(player)}</span>
          </button>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-textMuted">
        <span>{editable ? "Klik op een speler en sleep hem naar zijn positie. Transparante spelers zijn nog niet definitief geplaatst." : `${players.length} spelers in deze opstelling.`}</span>
        {editable && activeBlock && activeBlock.startMinute > 0 && <button type="button" onClick={() => {
          const remaining = blocks.filter(block => block.id !== activeBlock.id);
          onChange(remaining);
          setActiveBlockId(remaining[0]?.id ?? "block-0");
        }} className="rounded-lg border border-red-400/40 px-2 py-1 text-red-300">Dit blok verwijderen</button>}
      </div>
    </div>
  </div>;
}
