"use client";

import { useEffect, useState } from "react";

export function PlayerClipsShareDialog({ playerName, title, text, onClose }: { playerName: string; title: string; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;

  async function copyText() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function nativeShare() {
    try { await navigator.share({ title, text }); }
    catch (error) { if ((error as DOMException).name !== "AbortError") await copyText(); }
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="player-share-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-accent/40 bg-cardAlt p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Clips delen</p><h2 id="player-share-title" className="mt-1 text-xl font-bold text-textBright">{playerName}</h2></div>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="grid h-9 w-9 place-items-center rounded-full text-xl text-textMuted hover:bg-button">×</button>
      </div>
      <pre className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-input p-4 font-sans text-sm leading-6 text-textSecondary">{text}</pre>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {canNativeShare && <button type="button" onClick={() => void nativeShare()} className="rounded-xl border border-accent bg-accentDim px-4 py-3 font-semibold text-accent">↗ Delen</button>}
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-borderButton bg-button px-4 py-3 text-center font-semibold text-textPrimary">WhatsApp</a>
        <a href={emailUrl} className="rounded-xl border border-borderButton bg-button px-4 py-3 text-center font-semibold text-textPrimary">E-mail</a>
        <button type="button" onClick={() => void copyText()} className={`rounded-xl px-4 py-3 font-semibold ${canNativeShare ? "sm:col-span-3" : ""} bg-accent text-page`}>{copied ? "Tekst gekopieerd" : "Tekst en links kopiëren"}</button>
      </div>
    </section>
  </div>;
}
