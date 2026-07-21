"use client";

import { useEffect, useState } from "react";
import type { Tag } from "@/types/database";
import { formatTime } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";

function parseTime(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (!value.trim() || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function TagRow({ tag, selected, onToggleSelect, onSeek, onDelete, onUpdate }: {
  tag: Tag;
  selected: boolean;
  onToggleSelect: (tagId: string) => void;
  onSeek: (time: number) => void;
  onDelete: (tagId: string) => void;
  onUpdate?: (tagId: string, startTime: number, endTime: number) => void | Promise<void>;
}) {
  const marker = isPeriodMarker(tag.name);
  const endMarker = tag.name.trim().toLowerCase() === "end";
  const [startDraft, setStartDraft] = useState(formatTime(tag.start_time));
  const [endDraft, setEndDraft] = useState(formatTime(tag.end_time));

  useEffect(() => setStartDraft(formatTime(tag.start_time)), [tag.start_time]);
  useEffect(() => setEndDraft(formatTime(tag.end_time)), [tag.end_time]);

  function saveTimes() {
    if (!onUpdate) return;
    const parsedStart = parseTime(startDraft);
    const parsedEnd = marker ? parsedStart : parseTime(endDraft);
    if (parsedStart === null || parsedEnd === null) {
      setStartDraft(formatTime(tag.start_time));
      setEndDraft(formatTime(tag.end_time));
      return;
    }
    const safeEnd = marker ? parsedStart : Math.max(parsedStart, parsedEnd);
    setStartDraft(formatTime(parsedStart));
    setEndDraft(formatTime(safeEnd));
    void onUpdate(tag.id, parsedStart, safeEnd);
  }

  const timeInput = "w-[58px] rounded border border-border bg-input px-1.5 py-1 text-center text-[11px] text-textPrimary focus:border-accent focus:outline-none";

  return (
    <div className={`rounded-lg border px-2 py-2 ${selected && !marker ? "border-accent bg-accentDim" : "border-transparent bg-cardDeep hover:border-border"}`}>
      <div className="flex items-center gap-2">
        {marker ? (
          <span className="w-4 text-center text-sm" style={{ color: endMarker ? "white" : tag.color }} title="Period marker">{endMarker ? "🏁" : "⚑"}</span>
        ) : (
          <input type="checkbox" aria-label={`Select ${tag.name} for clip`} checked={selected} onChange={() => onToggleSelect(tag.id)} />
        )}
        <span className={`h-2.5 w-2.5 flex-shrink-0 ${marker ? "rotate-45 rounded-sm" : "rounded-full"}`} style={{ backgroundColor: tag.color }} />
        <button onClick={() => onSeek(tag.start_time)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-textPrimary">{tag.name}</button>
        <button onClick={() => onDelete(tag.id)} className="px-1 text-sm text-textMuted hover:text-red-400" aria-label={`Delete ${tag.name}`}>&times;</button>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-textMuted">
        <label className="flex items-center gap-1">
          <span>{marker ? "Time" : "Start"}</span>
          <input value={startDraft} onChange={(event) => setStartDraft(event.target.value)} onBlur={saveTimes} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={!onUpdate} className={timeInput} inputMode="numeric" />
        </label>
        {!marker && (
          <label className="flex items-center gap-1">
            <span>End</span>
            <input value={endDraft} onChange={(event) => setEndDraft(event.target.value)} onBlur={saveTimes} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={!onUpdate} className={timeInput} inputMode="numeric" />
          </label>
        )}
      </div>
    </div>
  );
}

export function TagList({ tags, selectedTagIds, onToggleSelect, onSeek, onDelete, onUpdate }: {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleSelect: (tagId: string) => void;
  onSeek: (time: number) => void;
  onDelete: (tagId: string) => void;
  onUpdate?: (tagId: string, startTime: number, endTime: number) => void | Promise<void>;
}) {
  if (tags.length === 0) return <p className="text-sm text-textMuted">No tags yet. Play the video and tap a tag button.</p>;

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {tags.map((tag) => <TagRow key={tag.id} tag={tag} selected={selectedTagIds.includes(tag.id)} onToggleSelect={onToggleSelect} onSeek={onSeek} onDelete={onDelete} onUpdate={onUpdate} />)}
    </div>
  );
}
