"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

export function ShareClipDialog({ clipName, shareUrl, onClose }: { clipName: string; shareUrl: string; onClose: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const isAutomaticClipName = /^Clip \(\d+ tags?\)$/i.test(clipName.trim());
  const publicClipName = isAutomaticClipName ? t("share.thisClip") : `“${clipName.trim()}”`;
  const shareText = t("share.watch", { clip: publicClipName });
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
  const emailSubject = isAutomaticClipName ? t("share.emailSubject") : t("share.emailSubjectNamed", { name: clipName.trim() });
  const emailUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;

  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: isAutomaticClipName ? t("share.clipTitle") : clipName, text: shareText, url: shareUrl });
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") await copyLink();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <section className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-accent/40 bg-cardAlt shadow-2xl shadow-black/60" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
        <div className="border-b border-border bg-cardDeep px-5 pb-4 pt-6">
          <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-xl text-textMuted hover:bg-button hover:text-textBright" aria-label={t("share.close")}>×</button>
          <div className="flex items-center gap-3 pr-10">
            <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-xl border border-accent/40 bg-accentDim">
              <Image src="/branding/logo.png" alt="" width={42} height={42} className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xs uppercase tracking-[0.18em] text-accent">Clipboard Coach Studio</p>
              <h2 id="share-dialog-title" className="mt-1 truncate text-xl font-bold text-textBright">{t("share.title")}</h2>
              <p className="truncate text-sm text-textSecondary">{clipName}</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm text-textSecondary">{t("share.anyone")}</p>

          <div className={`mt-4 flex items-center gap-2 rounded-xl border border-borderButton bg-input p-2 ${reviewed ? "" : "opacity-50"}`}>
            <span className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-textPrimary">{shareUrl}</span>
            <button type="button" disabled={!reviewed} onClick={() => void copyLink()} className="flex-shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page hover:opacity-90 disabled:cursor-not-allowed">
              {copied ? t("share.copied") : t("share.copyLink")}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {canNativeShare && <button type="button" disabled={!reviewed} onClick={() => void nativeShare()} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-accent bg-accentDim px-4 py-3 font-semibold text-accent hover:bg-cardHover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-3"><span aria-hidden="true">↗</span> {t("share.phone")}</button>}
            {reviewed ? <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-borderButton bg-button px-3 py-3 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-cardHover"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#25D366] font-bold text-black" aria-hidden="true">W</span> WhatsApp</a> : <span className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-borderButton bg-button px-3 py-3 text-sm font-semibold text-textMuted opacity-50">WhatsApp</span>}
            {reviewed ? <a href={emailUrl} className="flex items-center justify-center gap-2 rounded-xl border border-borderButton bg-button px-3 py-3 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-cardHover"><span className="text-lg text-accent" aria-hidden="true">✉</span> {t("share.email")}</a> : <span className="flex cursor-not-allowed items-center justify-center rounded-xl border border-borderButton bg-button px-3 py-3 text-sm text-textMuted opacity-50">{t("share.email")}</span>}
            <button type="button" disabled={!reviewed} onClick={() => void copyLink()} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-borderButton bg-button px-3 py-3 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-cardHover disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"><span className="text-accent" aria-hidden="true">⧉</span> {copied ? t("share.copied") : t("share.copy")}</button>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-cardDeep p-3 text-xs leading-5 text-textSecondary"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1" /><span>{t("share.review")}</span></label>

          <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-textMuted">
            <span className="text-accent" aria-hidden="true">●</span>
            {t("share.secure")}
          </div>
        </div>
      </section>
    </div>
  );
}
