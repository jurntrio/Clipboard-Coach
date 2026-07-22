"use client";

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", destructive = true, busy = false, onCancel, onConfirm }: {
  open: boolean; title: string; message: string; confirmLabel?: string; destructive?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-borderButton bg-cardAlt p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-xl font-bold ${destructive ? "bg-red-500/15 text-red-400" : "bg-accentDim text-accent"}`}>!</div>
          <div><h2 id="confirm-title" className="text-lg font-semibold text-textBright">{title}</h2><p id="confirm-message" className="mt-1 text-sm leading-6 text-textSecondary">{message}</p></div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${destructive ? "bg-red-500 text-white hover:bg-red-400" : "bg-accent text-page hover:opacity-90"}`}>{busy ? "Working..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
