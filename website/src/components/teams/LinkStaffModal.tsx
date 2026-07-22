"use client";

import { useState } from "react";

export function LinkStaffModal({ teamId, teamName, onClose, onLinked }: { teamId: string; teamName: string; onClose: () => void; onLinked: () => void }) {
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function linkStaff(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/team-staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId, fullName }) });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) { setError(body?.error || "The registered user could not be linked."); return; }
    onLinked();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-borderButton bg-cardAlt p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Link registered staff">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-textBright">Link registered staff</h2><p className="mt-1 text-sm text-textMuted">{teamName}</p></div><button type="button" onClick={onClose} className="text-sm text-textMuted hover:text-textPrimary">Close</button></div>
        <p className="mt-4 text-sm text-textSecondary">Enter the complete registered name in either order, or the exact registered email address. No user list or partial search is shown.</p>
        <form onSubmit={linkStaff} className="mt-4">
          <label className="text-sm text-textSecondary">Registered name or email<input required minLength={3} autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="First and last name, or email" autoComplete="off" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" /></label>
          {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-textSecondary hover:bg-cardHover">Cancel</button><button type="submit" disabled={saving || !fullName.trim()} className="rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{saving ? "Linking..." : "Link staff"}</button></div>
        </form>
      </div>
    </div>
  );
}
