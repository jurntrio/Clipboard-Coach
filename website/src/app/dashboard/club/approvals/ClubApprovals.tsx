"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = { email: string; full_name: string | null } | null;
type Membership = { profile_id: string; role: string; function_role: string | null; created_at: string; profiles: Profile };
type Team = { id: string; name: string; age_category: string | null; level_or_competition: string | null; created_at: string; profiles: Profile };
type Claim = { id: string; reason: string; created_at: string; profiles: Profile; people: { first_name: string; last_name: string } | null };
type ApprovalData = { memberships: Membership[]; teams: Team[]; claims: Claim[] };

export function ClubApprovals() {
  const router = useRouter();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/club/approvals", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Aanvragen konden niet geladen worden.");
    setData(body);
  }
  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, []);

  async function decide(type: "membership" | "team" | "claim", id: string, decision: "approved" | "rejected") {
    setBusy(`${type}:${id}`); setError("");
    const response = type === "team"
      ? await fetch("/api/club/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: id, status: decision === "approved" ? "active" : "rejected" }) })
      : await fetch("/api/club/approvals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, decision }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) setError(body?.error || "De aanvraag kon niet beoordeeld worden.");
    else { await load(); window.dispatchEvent(new Event("dashboard-badges:refresh")); router.refresh(); }
    setBusy("");
  }

  if (error && !data) return <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>;
  if (!data) return <p className="text-textMuted">Aanvragen laden…</p>;
  const total = data.memberships.length + data.teams.length + data.claims.length;
  return <div className="mt-6 space-y-6">
    {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p>}
    {!total && <div className="rounded-xl border border-dashed border-border p-10 text-center"><h2 className="font-semibold text-textBright">Alles is behandeld</h2><p className="mt-2 text-sm text-textMuted">Er zijn geen openstaande club-, team- of persoonsaanvragen.</p></div>}
    {!!data.memberships.length && <ApprovalSection title="Clublidmaatschappen" description="Personen die toegang tot deze club aanvragen.">{data.memberships.map(item => <ApprovalCard key={item.profile_id} title={profileName(item.profiles)} details={`${item.function_role || item.role} · ${formatDate(item.created_at)}`} busy={busy === `membership:${item.profile_id}`} onDecision={decision => decide("membership", item.profile_id, decision)} />)}</ApprovalSection>}
    {!!data.teams.length && <ApprovalSection title="Nieuwe teams" description="Teams die binnen deze club werden aangevraagd.">{data.teams.map(item => <ApprovalCard key={item.id} title={item.name} details={`${[item.age_category, item.level_or_competition].filter(Boolean).join(" · ") || "Geen extra teamgegevens"} · door ${profileName(item.profiles)} · ${formatDate(item.created_at)}`} busy={busy === `team:${item.id}`} onDecision={decision => decide("team", item.id, decision)} />)}</ApprovalSection>}
    {!!data.claims.length && <ApprovalSection title="Persoonskoppelingen" description="Accounts die vragen om aan een bestaande persoon gekoppeld te worden.">{data.claims.map(item => <ApprovalCard key={item.id} title={`${item.people?.first_name ?? ""} ${item.people?.last_name ?? ""}`.trim() || "Onbekende persoon"} details={`${profileName(item.profiles)} · ${item.reason} · ${formatDate(item.created_at)}`} busy={busy === `claim:${item.id}`} onDecision={decision => decide("claim", item.id, decision)} />)}</ApprovalSection>}
  </div>;
}

function ApprovalSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-bold text-textBright">{title}</h2><p className="mt-1 text-sm text-textMuted">{description}</p><div className="mt-4 space-y-3">{children}</div></section>;
}
function ApprovalCard({ title, details, busy, onDecision }: { title: string; details: string; busy: boolean; onDecision: (decision: "approved" | "rejected") => void }) {
  return <article className="flex flex-col gap-3 rounded-lg border border-borderSubtle bg-cardDeep p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><strong className="text-textPrimary">{title}</strong><p className="mt-1 text-xs text-textMuted">{details}</p></div><div className="flex gap-2"><button disabled={busy} onClick={() => onDecision("approved")} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page disabled:opacity-50">Goedkeuren</button><button disabled={busy} onClick={() => onDecision("rejected")} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary disabled:opacity-50">Afwijzen</button></div></article>;
}
function profileName(profile: Profile) { return profile?.full_name?.trim() || profile?.email || "Onbekende gebruiker"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
