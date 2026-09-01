"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { SvsBrand } from "@/components/branding/SvsBrand";
import { PasswordInput } from "@/components/auth/PasswordInput";

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
  const [clubName, setClubName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const supabase = createClient();

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!legalAccepted) { setError(t("auth.legalRequired")); return; }
    if (!clubName.trim() || !teamName.trim()) { setError("Vul je club en ploeg in."); return; }
    setLoading(true);
    setError("");

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`, data: {
        full_name: fullName, legal_accepted: true, legal_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, legal_statement_version: LEGAL_STATEMENT_VERSION, legal_locale: locale,
        club_onboarding: {
          request_kind: "personal_trainer",
          club_mode: "personal",
          club_name: clubName.trim(),
          team_mode: "new",
          team_name: teamName.trim(),
          age_category: ageCategory.trim()
        }
      } }
    });

    if (signUpError) {
      console.error("Signup failed", {
        name: signUpError.name,
        status: signUpError.status,
        code: "code" in signUpError ? signUpError.code : undefined,
        message: signUpError.message
      });
      setError(readableSignupError(signUpError, locale));
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-textMuted hover:text-accent font-mono text-xs uppercase tracking-widest mb-5">
          &larr; {t("common.backHome")}
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <SvsBrand className="mx-auto mb-5 w-full max-w-[320px]" priority />

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
                <fieldset className="space-y-4 rounded-xl border border-border bg-cardDeep p-4">
                  <legend className="px-2 font-display text-lg uppercase text-textBright">Mijn ploeg</legend>
                  <p className="text-sm leading-6 text-textMuted">
                    Vul de club en ploeg in waarvoor je werkt. Dit is alleen jouw persoonlijke werkruimte en koppelt je niet aan een officiële clubomgeving.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-textSecondary">Clubnaam
                      <input required value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="Bijvoorbeeld Olympic Ledegem" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" />
                    </label>
                    <label className="text-sm text-textSecondary">Ploegnaam
                      <input required value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Bijvoorbeeld U17" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" />
                    </label>
                  </div>
                  <label className="block text-sm text-textSecondary">Leeftijdscategorie <span className="text-textMuted">(optioneel)</span>
                    <input value={ageCategory} onChange={(event) => setAgeCategory(event.target.value)} placeholder="Bijvoorbeeld U17" className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" />
                  </label>
                  <p className="text-xs leading-5 text-textMuted">Andere trainers mogen dezelfde club- en ploegnaam gebruiken; accounts en inhoud blijven volledig gescheiden. Een officiële clubkoppeling kan later alleen op uitnodiging gebeuren.</p>
                </fieldset>
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
                  <PasswordInput
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
                {error && <div role="alert" aria-live="polite" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-300">
                  <strong className="block">{locale === "nl" ? "Registreren is niet gelukt" : "Registration failed"}</strong>
                  <span className="mt-1 block">{error}</span>
                </div>}
                <button
                  type="submit"
                  disabled={loading || !legalAccepted}
                  className="w-full py-3 bg-accent text-page rounded-lg font-bold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          <Image src="/branding/help.webp" alt="" width={36} height={36} />
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

function readableSignupError(error: unknown, locale: "nl" | "en") {
  const fallback = locale === "nl"
    ? "Je account kon niet worden aangemaakt. Probeer het opnieuw of neem contact op met info@sportvisualsystems.com."
    : "Your account could not be created. Try again or contact info@sportvisualsystems.com.";
  if (!error || typeof error !== "object") return fallback;
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
  const normalized = message.toLocaleLowerCase("en");
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return locale === "nl"
      ? "Dit e-mailadres is al geregistreerd. Kies Aanmelden of gebruik Wachtwoord vergeten."
      : "This email address is already registered. Sign in or use Forgot password.";
  }
  if (normalized.includes("rate limit") || candidate.status === 429) {
    return locale === "nl"
      ? "Er waren te veel registratiepogingen. Wacht enkele minuten en probeer opnieuw."
      : "There were too many registration attempts. Wait a few minutes and try again.";
  }
  if (normalized.includes("password")) {
    return locale === "nl"
      ? "Het wachtwoord wordt niet aanvaard. Gebruik minstens 6 tekens en probeer opnieuw."
      : "The password was not accepted. Use at least 6 characters and try again.";
  }
  if (normalized.includes("database error") || normalized.includes("saving new user")) {
    return locale === "nl"
          ? "De club- of teamkoppeling kon niet worden opgeslagen. Probeer opnieuw; blijft dit gebeuren, neem dan contact op met info@sportvisualsystems.com."
      : "The club or team link could not be saved. Try again; if this continues, contact info@sportvisualsystems.com.";
  }
  if (!message || message === "{}" || message === "[]" || message === "[object Object]") return fallback;
  return message;
}
