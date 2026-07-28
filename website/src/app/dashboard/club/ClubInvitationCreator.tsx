"use client";

import { useState } from "react";
import { CLUB_FUNCTION_ROLES } from "@/lib/club-access-options";

export function ClubInvitationCreator({ clubId, readOnly }: { clubId: string; readOnly: boolean }) {
  const [functionRole, setFunctionRole] = useState("trainer");
  const [expectedName, setExpectedName] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");

  async function createInvite() {
    setStatus("Uitnodiging maken…");
    setLink("");
    const response = await fetch("/api/club-invitations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, functionRole, expectedName })
    });
    const body = await response.json();
    if (!response.ok) return setStatus(body.error || "Uitnodiging kon niet worden gemaakt.");
    setLink(`${window.location.origin}/club-invite/${body.token}`);
    setStatus("Uitnodiging klaar. De link kan één keer worden gebruikt.");
  }

  if (readOnly) return null;
  return <section className="rounded-xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold text-textBright">Iemand uitnodigen</h2>
    <p className="mt-1 text-sm text-textMuted">Kies vooraf de rol. Als je een naam invult, moet de persoon zich met exact die naam registreren. De link vervalt na één registratie.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm text-textSecondary">Rol<select value={functionRole} onChange={(event) => setFunctionRole(event.target.value)} className={inputClass}>{CLUB_FUNCTION_ROLES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm text-textSecondary">Verwachte volledige naam (optioneel)<input value={expectedName} onChange={(event) => setExpectedName(event.target.value)} placeholder="Bijvoorbeeld Bart De Loof" className={inputClass} /></label>
    </div>
    <button type="button" onClick={() => void createInvite()} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page">Uitnodiging aanmaken</button>
    {status && <p className="mt-3 text-sm text-accent">{status}</p>}
    {link && <div className="mt-3 flex gap-2 rounded-lg border border-borderSubtle bg-cardDeep p-2"><input readOnly value={link} className="min-w-0 flex-1 bg-transparent px-2 text-xs text-textPrimary" /><button type="button" onClick={() => void navigator.clipboard.writeText(link)} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-accent">Link kopiëren</button></div>}
  </section>;
}

const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";
