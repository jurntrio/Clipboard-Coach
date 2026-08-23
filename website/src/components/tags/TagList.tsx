"use client";

import { useEffect, useState } from "react";
import type { Tag, TagDrawing } from "@/types/database";
import { formatTime } from "@/lib/utils";
import { isPeriodMarker } from "@/lib/tags";
import { useI18n } from "@/i18n/client";

function parseTime(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (!value.trim() || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2 && parts[1] < 60) return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export type TagListMeta = {
  badge: string;
  byLabel: string;
  onCalibrate?: () => void;
};

function TagRow({ tag, meta, selected, onToggleSelect, onSeek, onDelete, onUpdate, onRename, onDraw, currentTime, onDrawingDurationChange, onOpenDrawing }: {
  tag: Tag;
  meta?: TagListMeta;
  selected: boolean;
  onToggleSelect: (tagId: string) => void;
  onSeek: (time: number) => void;
  onDelete: (tagId: string) => void;
  onUpdate?: (tagId: string, startTime: number, endTime: number) => void | Promise<void>;
  onRename?: (tagId: string, name: string) => void | Promise<void>;
  onDraw?: (tag: Tag) => void;
  currentTime?: number;
  onDrawingDurationChange?: (tag: Tag, drawingId: string, durationSeconds: number) => void | Promise<void>;
  onOpenDrawing?: (tag: Tag, drawing: TagDrawing) => void;
}) {
  const { t } = useI18n();
  const marker = isPeriodMarker(tag.name);
  const endMarker = tag.name.trim().toLowerCase() === "end";
  const [startDraft, setStartDraft] = useState(formatTime(tag.start_time));
  const [endDraft, setEndDraft] = useState(formatTime(tag.end_time));
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(tag.name);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => setStartDraft(formatTime(tag.start_time)), [tag.start_time]);
  useEffect(() => setEndDraft(formatTime(tag.end_time)), [tag.end_time]);
  useEffect(() => setNameDraft(tag.name), [tag.name]);

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || !onRename) { setNameDraft(tag.name); setEditingName(false); return; }
    setSavingName(true);
    await onRename(tag.id, name);
    setSavingName(false);
    setEditingName(false);
  }

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
          <span className="w-4 text-center text-sm" style={{ color: endMarker ? "white" : tag.color }} title={t("tag.periodMarker")}>{endMarker ? "🏁" : "⚑"}</span>
        ) : (
          <input type="checkbox" aria-label={t("tag.selectForClip", { name: tag.name })} checked={selected} onChange={() => onToggleSelect(tag.id)} />
        )}
        <span className={`h-2.5 w-2.5 flex-shrink-0 ${marker ? "rotate-45 rounded-sm" : "rounded-full"}`} style={{ backgroundColor: tag.color }} />
        {editingName ? <input autoFocus disabled={savingName} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={() => void saveName()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape" && !savingName) { setNameDraft(tag.name); setEditingName(false); } }} className="min-w-0 flex-1 rounded border border-accent bg-input px-2 py-1 text-sm text-textPrimary outline-none disabled:opacity-60" /> : <button onClick={() => onSeek(tag.start_time)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-textPrimary">{tag.name}</button>}
        {meta?.onCalibrate && <button type="button" onClick={meta.onCalibrate} title={t("liveTags.calibrate")} aria-label={t("liveTags.calibrate")} className="px-1 text-xs text-textMuted hover:text-accent">🎯</button>}
        {!marker && onRename && <button type="button" onClick={() => setEditingName(true)} className="px-1 text-xs text-textMuted hover:text-accent">{t("common.edit")}</button>}
        <button onClick={() => onDelete(tag.id)} className="px-1 text-sm text-textMuted hover:text-red-400" aria-label={t("tag.deleteNamed", { name: tag.name })}>&times;</button>
      </div>
      {meta && <div className="mt-1 flex items-center gap-1.5 pl-8 text-[10px] text-textMuted"><span className="inline-grid h-4 w-4 place-items-center rounded bg-accentDim font-bold text-accent">{meta.badge}</span><span className="truncate">{meta.byLabel}</span></div>}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-textMuted">
        {!marker && onDraw && currentTime !== undefined && currentTime >= tag.start_time && currentTime <= tag.end_time && (
          <button type="button" onClick={() => onDraw(tag)} className="mr-auto rounded border border-accent/60 bg-accentDim px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-page">
            {t("tag.draw")}
          </button>
        )}
        <label className="flex items-center gap-1">
          <span>{marker ? t("tag.time") : t("tag.start")}</span>
          <input value={startDraft} onChange={(event) => setStartDraft(event.target.value)} onBlur={saveTimes} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={!onUpdate} className={timeInput} inputMode="numeric" />
        </label>
        {!marker && (
          <label className="flex items-center gap-1">
            <span>{t("tag.end")}</span>
            <input value={endDraft} onChange={(event) => setEndDraft(event.target.value)} onBlur={saveTimes} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={!onUpdate} className={timeInput} inputMode="numeric" />
          </label>
        )}
      </div>
      {!marker && (tag.drawings?.length ?? 0) > 0 && <div className="mt-2 flex flex-wrap gap-2">{tag.drawings.map((drawing) => <div key={drawing.id} className="w-24 rounded border border-border bg-card p-1"><button type="button" onClick={() => onOpenDrawing?.(tag, drawing)} className="block w-full" aria-label={t("tag.editDrawingAt", { time: formatTime(drawing.video_time) })}><img src={drawing.url} alt={t("tag.drawingAt", { time: formatTime(drawing.video_time) })} className="h-12 w-full rounded bg-black object-cover" /></button><label className="mt-1 flex items-center gap-1 text-[10px] text-textMuted"><input type="number" min={1} max={30} value={drawing.duration_seconds} onChange={(event) => void onDrawingDurationChange?.(tag, drawing.id, Math.min(30, Math.max(1, Number(event.target.value) || 1)))} className="w-10 rounded border border-border bg-input px-1 text-textPrimary" /> {t("tag.seconds")}</label></div>)}</div>}
    </div>
  );
}

export function TagList({ tags, tagMetaById, selectedTagIds, onToggleSelect, onSeek, onDelete, onUpdate, onRename, onDraw, currentTime, onDrawingDurationChange, onOpenDrawing }: {
  tags: Tag[];
  tagMetaById?: Record<string, TagListMeta>;
  selectedTagIds: string[];
  onToggleSelect: (tagId: string) => void;
  onSeek: (time: number) => void;
  onDelete: (tagId: string) => void;
  onUpdate?: (tagId: string, startTime: number, endTime: number) => void | Promise<void>;
  onRename?: (tagId: string, name: string) => void | Promise<void>;
  onDraw?: (tag: Tag) => void;
  currentTime?: number;
  onDrawingDurationChange?: (tag: Tag, drawingId: string, durationSeconds: number) => void | Promise<void>;
  onOpenDrawing?: (tag: Tag, drawing: TagDrawing) => void;
}) {
  const { t } = useI18n();
  if (tags.length === 0) return <p className="text-sm text-textMuted">{t("tag.none")}</p>;
  const sortedTags = [...tags].sort((a, b) =>
    a.start_time - b.start_time ||
    a.end_time - b.end_time ||
    a.created_at.localeCompare(b.created_at)
  );

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {sortedTags.map((tag) => <TagRow key={tag.id} tag={tag} meta={tagMetaById?.[tag.id]} selected={selectedTagIds.includes(tag.id)} onToggleSelect={onToggleSelect} onSeek={onSeek} onDelete={onDelete} onUpdate={onUpdate} onRename={onRename} onDraw={onDraw} currentTime={currentTime} onDrawingDurationChange={onDrawingDurationChange} onOpenDrawing={onOpenDrawing} />)}
    </div>
  );
}
