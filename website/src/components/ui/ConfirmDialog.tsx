"use client";

import { useI18n } from "@/i18n/client";

export function ConfirmDialog({ open, title, message, confirmLabel, destructive = true, busy = false, onCancel, onConfirm }: {
  open: boolean; title: string; message: string; confirmLabel?: string; destructive?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={busy ? undefined : onCancel}>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-accent/35 bg-cardAlt shadow-2xl shadow-black/60" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onClick={(event) => event.stopPropagation()}>
        <div className="h-1 bg-gradient-to-r from-accent via-accent/70 to-transparent" />
        <div className="flex items-center justify-between border-b border-borderSubtle px-5 py-3">
          <span className="rounded-md border border-accent/40 bg-accentDim px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-accent">SVS</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-textMuted">Sport Visual Systems</span>
        </div>
        <div className="p-5">
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl border text-xl font-black ${destructive ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-accent/30 bg-accentDim text-accent"}`}>!</div>
          <div><h2 id="confirm-title" className="text-lg font-semibold text-textBright">{title}</h2><p id="confirm-message" className="mt-1 text-sm leading-6 text-textSecondary">{message}</p></div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent disabled:cursor-not-allowed disabled:opacity-50">{t("common.cancel")}</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${destructive ? "bg-red-500 text-white hover:bg-red-400" : "bg-accent text-page hover:opacity-90"}`}>{busy ? t("common.working") : (confirmLabel ?? t("common.delete"))}</button>
        </div>
        </div>
      </div>
    </div>
  );
}
