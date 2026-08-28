"use client";

import { useEffect, useState } from "react";

export function MatchTagLinkButton({ matchId }: { matchId: string }) {
  const [tagUrl, setTagUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function getTagLink(copyAfterLoad = true) {
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/matches/${matchId}/tag-link`, { method: "POST" });
    const body = await response.json().catch(() => null) as { token?: string; error?: string } | null;
    setBusy(false);
    if (!response.ok || !body?.token) {
      setNotice(body?.error || "De taglink kon niet worden gemaakt.");
      return;
    }

    const url = `${window.location.origin}/tag/${body.token}`;
    setTagUrl(url);
    if (!copyAfterLoad) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Taglink gekopieerd.");
    } catch {
      setNotice("Kopieer de taglink hieronder.");
    }
  }

  useEffect(() => {
    void getTagLink(false);
    // De endpoint geeft een bestaande actieve link terug en maakt er alleen een als die ontbreekt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function copyTagLink() {
    try {
      await navigator.clipboard.writeText(tagUrl);
      setNotice("Taglink gekopieerd.");
    } catch {
      setNotice("Automatisch kopiëren lukte niet. Selecteer de link hieronder.");
    }
  }

  return <div className="w-full sm:w-auto">
    <button type="button" disabled={busy || !tagUrl} onClick={() => void copyTagLink()} className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-bold text-page disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? "Live-taglink laden…" : "Live-taglink kopiëren"}
    </button>
    {tagUrl && <div className="mt-2 flex max-w-xl gap-2 rounded-xl border border-accent/30 bg-card p-2">
      <input aria-label="Externe taglink" readOnly value={tagUrl} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 bg-transparent px-2 text-xs text-textPrimary" />
      <button type="button" onClick={() => void copyTagLink()} className="shrink-0 rounded-lg border border-borderButton px-3 py-2 text-xs font-semibold text-accent">Kopiëren</button>
    </div>}
    {notice && <p className="mt-1 text-xs text-textMuted" role="status">{notice}</p>}
  </div>;
}
