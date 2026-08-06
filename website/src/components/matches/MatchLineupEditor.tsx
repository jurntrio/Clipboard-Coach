"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export type LineupPosition = { playerId: string; x: number; y: number };

type Player = { id: string; first_name: string; last_name: string; jersey_number: number | null };

export function MatchLineupEditor({ players, positions, editable, onChange }: {
  players: Player[];
  positions: LineupPosition[];
  editable: boolean;
  onChange: (positions: LineupPosition[]) => void;
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const positionedIds = new Set(positions.map(position => position.playerId));
  const availablePlayers = players.filter(player => !positionedIds.has(player.id));

  function playerName(player: Player) {
    return `${player.first_name} ${player.last_name}`.trim();
  }

  function coordinates(clientX: number, clientY: number) {
    const bounds = pitchRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(4, Math.min(96, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(4, Math.min(96, ((clientY - bounds.top) / bounds.height) * 100))
    };
  }

  function placePlayer(clientX: number, clientY: number, playerId = selectedPlayerId) {
    if (!editable || !playerId) return;
    const point = coordinates(clientX, clientY);
    if (!point) return;
    onChange([...positions.filter(position => position.playerId !== playerId), { playerId, ...point }]);
    setSelectedPlayerId("");
  }

  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
    <div>
      <div
        ref={pitchRef}
        className={`relative aspect-[1.49/1] overflow-hidden rounded-xl border border-white/20 bg-emerald-900 ${selectedPlayerId ? "cursor-crosshair ring-2 ring-accent" : ""}`}
        onClick={event => placePlayer(event.clientX, event.clientY)}
        onDragOver={event => { if (editable) event.preventDefault(); }}
        onDrop={event => {
          event.preventDefault();
          placePlayer(event.clientX, event.clientY, event.dataTransfer.getData("text/player-id"));
        }}
        aria-label="Voetbalveld met opstelling"
      >
        <Image src="/branding/Training/11vs11-groen.png" alt="Voetbalveld" fill sizes="(max-width: 1024px) 100vw, 700px" className="object-fill" priority={false} />
        {positions.map(position => {
          const player = players.find(item => item.id === position.playerId);
          if (!player) return null;
          return <button
            key={position.playerId}
            type="button"
            draggable={editable}
            disabled={!editable}
            onDragStart={event => event.dataTransfer.setData("text/player-id", position.playerId)}
            onClick={event => { event.stopPropagation(); if (editable) setSelectedPlayerId(position.playerId); }}
            title={editable ? `${playerName(player)} verplaatsen` : playerName(player)}
            className="absolute z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-accent text-xs font-black text-page shadow-lg disabled:cursor-default sm:h-12 sm:w-12"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            {player.jersey_number ?? player.first_name.slice(0, 2).toUpperCase()}
            <span className="pointer-events-none absolute top-full mt-1 max-w-24 truncate rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">{playerName(player)}</span>
          </button>;
        })}
      </div>
      {editable && <p className="mt-2 text-xs text-textMuted">
        {selectedPlayerId ? "Klik op het veld om de speler te plaatsen." : "Kies een speler of sleep een speler naar het veld. Klik op een geplaatste speler om die te verplaatsen."}
      </p>}
    </div>

    <div className="space-y-3">
      <div>
        <strong className="text-xs uppercase tracking-wide text-textMuted">Beschikbare spelers ({availablePlayers.length})</strong>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {availablePlayers.map(player => <button
            key={player.id}
            type="button"
            draggable={editable}
            disabled={!editable}
            onDragStart={event => event.dataTransfer.setData("text/player-id", player.id)}
            onClick={() => setSelectedPlayerId(player.id)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${selectedPlayerId === player.id ? "border-accent bg-accentDim text-textBright" : "border-borderSubtle bg-cardDeep text-textPrimary"} disabled:cursor-default`}
          >
            <span className="w-6 font-black text-accent">{player.jersey_number ?? "–"}</span>
            <span className="truncate">{playerName(player)}</span>
          </button>)}
          {!availablePlayers.length && <p className="text-sm text-textMuted">Alle geselecteerde spelers staan op het veld.</p>}
        </div>
      </div>
      {editable && positions.length > 0 && <div className="flex flex-wrap gap-2">
        {positions.map(position => {
          const player = players.find(item => item.id === position.playerId);
          return player ? <button key={position.playerId} type="button" onClick={() => onChange(positions.filter(item => item.playerId !== position.playerId))}
            className="rounded-lg border border-borderButton px-2 py-1 text-xs text-textSecondary" title="Van het veld verwijderen">
            {player.jersey_number ?? "–"} {playerName(player)} ×
          </button> : null;
        })}
      </div>}
      {!editable && positions.length === 0 && <p className="text-sm text-textMuted">Geen visuele opstelling bewaard.</p>}
    </div>
  </div>;
}
