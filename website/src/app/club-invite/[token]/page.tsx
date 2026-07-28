"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

type Invite = { clubName: string; roleLabel: string; expectedName: string | null };
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-BE");

export default function ClubInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/club-invitations/${token}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setInvite(body);
      if (body.expectedName) setFullName(body.expectedName);
    }).catch((reason) => setError(reason.message || "Ongeldige uitnodiging.")).finally(() => setLoading(false));
  }, [token]);

  async function signup(event: React.FormEvent) {
    event.preventDefault();
    if (!invite || !accepted) return;
    if (invite.expectedName && normalize(fullName) !== normalize(invite.expectedName)) {
      setError(`Registreer met de naam “${invite.expectedName}”.`);
      return;
    }
    setLoading(true); setError("");
    const supabase = createClient();
    const { error: signupError } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName.trim(), club_invite_token: token, legal_accepted: true,
          legal_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION, legal_statement_version: LEGAL_STATEMENT_VERSION, legal_locale: "nl" } }
    });
    setLoading(false);
    if (signupError) return setError(signupError.message.includes("Database error") ? "De naam komt niet overeen, de link is verlopen of werd al gebruikt." : signupError.message);
    setSubmitted(true);
  }

  return <div className="flex min-h-screen items-center justify-center bg-page p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
    <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-5" />
    {loading ? <p className="text-center text-textMuted">Uitnodiging laden…</p> : submitted ? <div className="text-center"><h1 className="text-2xl font-bold text-textBright">Controleer je e-mail</h1><p className="mt-2 text-textSecondary">Bevestig je account om toegang te krijgen.</p></div> : error && !invite ? <p className="text-center text-red-300">{error}</p> : <>
      <h1 className="text-2xl font-bold text-textBright">Uitnodiging voor {invite?.clubName}</h1>
      <p className="mt-2 text-sm text-textMuted">Je wordt geregistreerd als <strong className="text-textPrimary">{invite?.roleLabel}</strong>. Deze link kan maar door één persoon worden gebruikt.</p>
      <form onSubmit={signup} className="mt-5 space-y-4">
        <label className="block text-sm text-textSecondary">Volledige naam<input required value={fullName} onChange={(event) => setFullName(event.target.value)} readOnly={!!invite?.expectedName} className={inputClass} /></label>
        <label className="block text-sm text-textSecondary">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
        <label className="block text-sm text-textSecondary">Wachtwoord<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
        <label className="flex items-start gap-2 text-sm text-textSecondary"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>Ik ga akkoord met de <Link href="/terms" target="_blank" className="text-accent">Gebruiksvoorwaarden</Link> en de <Link href="/privacy" target="_blank" className="text-accent">Privacyverklaring</Link>.</span></label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button disabled={loading || !accepted} className="w-full rounded-lg bg-accent py-3 font-bold text-page disabled:opacity-50">Registreren</button>
      </form>
    </>}
  </div></div>;
}
const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-3 text-textPrimary read-only:opacity-70";
