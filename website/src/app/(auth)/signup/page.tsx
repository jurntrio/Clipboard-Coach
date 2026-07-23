"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { LegalLinks } from "@/components/legal/LegalLinks";

export default function SignupPage() {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const supabase = createClient();

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!legalAccepted) { setError(t("auth.legalRequired")); return; }
    setLoading(true);
    setError("");

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, legal_accepted: true, legal_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, legal_statement_version: LEGAL_STATEMENT_VERSION, legal_locale: locale } }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-textMuted hover:text-accent font-mono text-xs uppercase tracking-widest mb-5">
          &larr; {t("common.backHome")}
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-4" />

          {submitted ? (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.almostThere")}</h1>
              <p className="mt-3 text-textSecondary">{t("auth.checkEmail")}</p>
              <Link href="/login" className="inline-block mt-4 text-accent hover:underline font-semibold">
                {t("auth.goLogin")}
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.createCoach")}</h1>
              <p className="text-textMuted text-sm mb-6">{t("auth.createIntro")}</p>

              <form onSubmit={handleSignup} className="space-y-4 text-left">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.fullName")}</label>
                  <input
                    type="text"
                    placeholder={t("auth.yourName")}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.email")}</label>
                  <input
                    type="email"
                    placeholder="coach@club.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.password")}</label>
                  <input
                    type="password"
                    placeholder={t("auth.passwordHint")}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                    required
                  />
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-cardDeep p-3 text-sm leading-5 text-textSecondary">
                  <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-1" required />
                  <span>{t("auth.legalPrefix")} <Link href="/terms" target="_blank" className="font-semibold text-accent hover:underline">{t("legal.terms")}</Link>. {t("auth.legalPrivacyPrefix")} <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:underline">{t("legal.privacy")}</Link>.</span>
                </label>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !legalAccepted}
                  className="w-full py-3 bg-accent text-page rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? t("auth.creating") : t("auth.signUp")}
                </button>
              </form>

              <p className="mt-4 text-textSecondary text-sm">
                {t("auth.alreadyAccount")} {" "}
                <Link href="/login" className="text-accent hover:underline font-semibold">
                  {t("auth.signIn")}
                </Link>
              </p>
            </>
          )}
        </div>

        <button
          onClick={() => setShowHelp((current) => !current)}
          className="w-full mt-4 flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-accent transition text-left"
        >
          <Image src="/branding/help.png" alt="" width={36} height={36} />
          <span className="text-textPrimary font-semibold">{t("auth.needHelp")}</span>
        </button>

        {showHelp && (
          <div className="mt-2 bg-cardAlt border border-border rounded-xl p-4 text-textSecondary text-sm space-y-2">
            <p>{t("auth.realEmail")}</p>
            <p>{t("auth.passwordRule")}</p>
          </div>
        )}
        <div className="mt-4 flex justify-center"><LanguageSwitcher compact /></div><div className="mt-4"><LegalLinks /></div>
      </div>
    </div>
  );
}
