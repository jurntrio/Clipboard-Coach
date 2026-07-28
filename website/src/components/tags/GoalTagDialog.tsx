"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";

export type GoalTagDetails = {
  eventType: "goal_for" | "goal_against";
  scorerId: string | null;
  assistId: string | null;
};

export function GoalTagDialog({ players, onCancel, onConfirm }: {
  players: Player[];
  onCancel: () => void;
  onConfirm: (details: GoalTagDetails) => void | Promise<void>;
}) {
  const [eventType, setEventType] = useState<GoalTagDetails["eventType"] | null>(null);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const canConfirm = eventType !== null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4" onClick={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-borderButton bg-cardAlt p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Goal</p><h2 id="goal-dialog-title" className="mt-1 text-xl font-semibold text-textBright">Type doelpunt</h2></div>
          <button type="button" onClick={onCancel} aria-label="Sluiten" className="text-2xl text-textMuted hover:text-textPrimary">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([["goal_for", "Goal voor"], ["goal_against", "Goal tegen"]] as const).map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 text-sm font-semibold ${eventType === value ? "border-accent bg-accentDim text-textBright" : "border-border bg-cardDeep text-textSecondary"}`}>
              <input type="radio" name="goal-type" value={value} checked={eventType === value} onChange={() => setEventType(value)} className="mr-2 accent-[var(--color-accent)]" />{label}
            </label>
          ))}
        </div>
        {eventType === "goal_for" && (
          <div className="mt-5 space-y-4 border-t border-border pt-5">
            <label className="block text-sm text-textSecondary">Doelpuntenmaker
              <select autoFocus value={scorerId} onChange={(event) => { setScorerId(event.target.value); if (assistId === event.target.value) setAssistId(""); }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-textPrimary">
                <option value="">Onbekend / later invullen</option>
                {players.map((player) => <option key={player.id} value={player.id}>{getPlayerDisplayName(player)}</option>)}
              </select>
            </label>
            <label className="block text-sm text-textSecondary">Assistgever
              <select value={assistId} onChange={(event) => setAssistId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-textPrimary">
                <option value="">Geen assist</option>
                {players.filter((player) => player.id !== scorerId).map((player) => <option key={player.id} value={player.id}>{getPlayerDisplayName(player)}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg bg-button px-4 py-2.5 text-textPrimary">Annuleren</button>
          <button type="button" disabled={!canConfirm} onClick={() => eventType && onConfirm({ eventType, scorerId: scorerId || null, assistId: assistId || null })} className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-semibold text-page disabled:opacity-40">Goal opslaan</button>
        </div>
      </section>
    </div>
  );
}
