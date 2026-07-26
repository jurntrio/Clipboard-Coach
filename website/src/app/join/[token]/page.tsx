"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export default function JoinPlayerPage() {
  const { locale, t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const supabase = createClient();
  const [invite, setInvite] = useState<{ playerName: string; teamName: string } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/player-invites/${token}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Deze link is niet geldig.");
        setInvite(body);
      })
      .catch((reason) => setInviteError(reason instanceof Error ? reason.message : "Deze link is niet geldig."))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!legalAccepted) { setError("Je moet de voorwaarden en het privacybeleid aanvaarden."); return; }
    setLoading(true);
    setError("");
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: {
        full_name: fullName, legal_accepted: true, legal_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, legal_statement_version: LEGAL_STATEMENT_VERSION, legal_locale: locale,
        player_invite_token: token
      } }
    });
    setLoading(false);
    if (signUpError) { setError(signUpError.message); return; }
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-textMuted hover:text-accent font-mono text-xs uppercase tracking-widest mb-5">&larr; {t("common.backHome")}</Link>
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-4" />
          {loadingInvite ? (
            <p className="text-textMuted text-sm">Uitnodiging laden…</p>
          ) : inviteError ? (
            <p className="text-red-400 text-sm">{inviteError}</p>
          ) : submitted ? (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.almostThere")}</h1>
              <p className="mt-3 text-textSecondary">{t("auth.checkEmail")}</p>
              <Link href="/login" className="inline-block mt-4 text-accent hover:underline font-semibold">{t("auth.goLogin")}</Link>
            </>
          ) : (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">Ouderaccount aanmaken</h1>
              <p className="text-textMuted text-sm mb-6">Je krijgt toegang tot de wedstrijden en clips van {invite?.playerName}{invite?.teamName ? ` (${invite.teamName})` : ""}.</p>
              <form onSubmit={handleSignup} className="space-y-4 text-left">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">Naam</label>
                  <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border" required />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.email")}</label>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border" required />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.password")}</label>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border" required />
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-cardDeep p-3 text-sm leading-5 text-textSecondary">
                  <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-1" required />
                  <span>{t("auth.legalPrefix")} <Link href="/terms" target="_blank" className="font-semibold text-accent hover:underline">{t("legal.terms")}</Link>. {t("auth.legalPrivacyPrefix")} <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:underline">{t("legal.privacy")}</Link>.</span>
                </label>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={loading || !legalAccepted} className="w-full py-3 bg-accent text-page rounded-lg font-bold hover:opacity-90 disabled:opacity-50">{loading ? t("auth.creating") : t("auth.signUp")}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
