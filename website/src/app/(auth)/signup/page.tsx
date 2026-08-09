"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { SvsBrand } from "@/components/branding/SvsBrand";

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
  const [clubMode, setClubMode] = useState<"existing" | "new">("existing");
  const [clubSearch, setClubSearch] = useState("");
  const [clubs, setClubs] = useState<{ id: string; name: string; registration_number: string | null; similarity_score: number }[]>([]);
  const [clubId, setClubId] = useState("");
  const [clubName, setClubName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string; age_category: string | null; level_or_competition: string | null }[]>([]);
  const [requestKind, setRequestKind] = useState<"staff" | "contact" | "none">("staff");
  const [teamMode, setTeamMode] = useState<"none" | "existing" | "new">("none");
  const [teamId, setTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [levelOrCompetition, setLevelOrCompetition] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [playerFirstName, setPlayerFirstName] = useState("");
  const [playerLastName, setPlayerLastName] = useState("");
  const [playerDateOfBirth, setPlayerDateOfBirth] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [similarAcknowledged, setSimilarAcknowledged] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDirectoryLoading(true); setDirectoryError("");
      try {
        const response = await fetch(`/api/club-directory?search=${encodeURIComponent(clubMode === "new" ? clubName : clubSearch)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setClubs(body.clubs ?? []);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setDirectoryError((reason as Error).message);
      } finally { setDirectoryLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [clubMode, clubSearch, clubName]);

  useEffect(() => {
    if (!clubId) { setTeams([]); return; }
    const controller = new AbortController();
    setDirectoryLoading(true); setDirectoryError("");
    fetch(`/api/club-directory?clubId=${encodeURIComponent(clubId)}`, { signal: controller.signal })
        .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setTeams(body.teams ?? []); })
      .catch((reason) => { if (reason.name !== "AbortError") setDirectoryError(reason.message); })
      .finally(() => setDirectoryLoading(false));
    return () => controller.abort();
  }, [clubId]);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    if (!legalAccepted) { setError(t("auth.legalRequired")); return; }
    if (requestKind !== "none" && clubMode === "existing" && !clubId) { setError(t("onboarding.clubRequired")); return; }
    if (requestKind !== "none" && clubMode === "new" && (!clubName.trim() || !teamName.trim())) { setError(t("onboarding.newRequired")); return; }
    if (requestKind === "staff" && teamRole === "custom" && !customRoleName.trim()) { setError("Vul de andere functie in."); return; }
    if (requestKind === "contact" && (!playerFirstName.trim() || !playerLastName.trim() || !playerDateOfBirth)) { setError("Vul de naam en geboortedatum van de speler in."); return; }
    const similar = clubMode === "new" ? clubs.find((club) => club.similarity_score >= 0.72) : undefined;
    if (similar && !similarAcknowledged) { setError(t("onboarding.similarConfirm")); return; }
    setLoading(true);
    setError("");

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`, data: {
        full_name: fullName, legal_accepted: true, legal_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, legal_statement_version: LEGAL_STATEMENT_VERSION, legal_locale: locale,
        club_onboarding: {
          request_kind: requestKind,
          club_mode: clubMode, club_id: clubMode === "existing" ? clubId : undefined,
          club_name: clubMode === "new" ? clubName.trim() : undefined,
          registration_number: clubMode === "new" ? registrationNumber.trim() : undefined,
          team_mode: clubMode === "new" ? "new" : teamMode === "new" && !teamName.trim() ? "none" : teamMode,
          team_id: clubMode === "existing" && teamMode === "existing" ? teamId : undefined,
          team_name: teamMode === "new" || clubMode === "new" ? teamName.trim() : undefined,
          age_category: ageCategory.trim(), level_or_competition: levelOrCompetition.trim(),
          team_role: teamRole || undefined, function_role: teamRole || undefined,
          custom_role_name: teamRole === "custom" ? customRoleName.trim() : undefined,
          player_first_name: requestKind === "contact" ? playerFirstName.trim() : undefined,
          player_last_name: requestKind === "contact" ? playerLastName.trim() : undefined,
          player_date_of_birth: requestKind === "contact" ? playerDateOfBirth : undefined,
          similar_club_acknowledged: similarAcknowledged
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
                <fieldset className="space-y-3 rounded-xl border border-border bg-cardDeep p-4">
                  <legend className="px-2 font-display text-lg uppercase text-textBright">Hoe wil je Sport Visual Systems gebruiken?</legend>
                  <div className="grid gap-2 sm:grid-cols-3">{([['staff','Staflid'],['contact','Contactpersoon'],['none','Nog geen functie']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => { setRequestKind(value); if (value !== 'staff') setTeamMode('none'); }} className={`rounded-lg border p-3 text-left text-sm ${requestKind === value ? "border-accent bg-accentDim text-textPrimary" : "border-borderButton text-textSecondary"}`}>{label}</button>)}</div>
                  <p className="text-xs text-textMuted">Je keuze geeft nog geen toegang. Een clubbeheerder keurt de koppeling en rechten goed.</p>
                </fieldset>
                {requestKind !== "none" && <fieldset className="space-y-4 rounded-xl border border-border bg-cardDeep p-4">
                  <legend className="px-2 font-display text-lg uppercase text-textBright">{t("onboarding.title")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => { setClubMode("existing"); setSimilarAcknowledged(false); }} className={`rounded-lg border p-3 text-left text-sm ${clubMode === "existing" ? "border-accent bg-accentDim text-textPrimary" : "border-borderButton text-textSecondary"}`}>{t("onboarding.existingClub")}</button>
                    {requestKind === "staff" && <button type="button" onClick={() => { setClubMode("new"); setClubId(""); setTeamMode("new"); }} className={`rounded-lg border p-3 text-left text-sm ${clubMode === "new" ? "border-accent bg-accentDim text-textPrimary" : "border-borderButton text-textSecondary"}`}>{t("onboarding.newClub")}</button>}
                  </div>
                  {clubMode === "existing" ? <>
                    <label className="block text-sm text-textSecondary">{t("onboarding.searchClub")}<input value={clubSearch} onChange={(e) => setClubSearch(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>
                    <div className="max-h-44 space-y-2 overflow-y-auto">
                      {clubs.map((club) => <button key={club.id} type="button" onClick={() => { setClubId(club.id); setTeamId(""); setTeamMode("none"); }} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${clubId === club.id ? "border-accent bg-accentDim" : "border-borderButton bg-card"}`}><span className="font-semibold text-textPrimary">{club.name}</span>{club.registration_number && <span className="ml-2 text-textMuted">· {t("onboarding.registrationNumber")} {club.registration_number}</span>}</button>)}
                      {!directoryLoading && !clubs.length && <p className="text-sm text-textMuted">{t("onboarding.noClubs")}</p>}
                    </div>
                  </> : <>
                    <label className="block text-sm text-textSecondary">{t("onboarding.officialClubName")}<input required value={clubName} onChange={(e) => { setClubName(e.target.value); setSimilarAcknowledged(false); }} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>
                    <label className="block text-sm text-textSecondary">{t("onboarding.registrationOptional")}<input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>
                    {clubName.trim() && clubs.some((club) => club.similarity_score >= 0.72) && <label className="block rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"><span className="block font-semibold">{t("onboarding.similarWarning")}</span><span className="block py-1">{clubs.find((club) => club.similarity_score >= 0.72)?.name}</span><span className="flex items-start gap-2"><input type="checkbox" checked={similarAcknowledged} onChange={(e) => setSimilarAcknowledged(e.target.checked)} />{t("onboarding.similarAcknowledge")}</span></label>}
                  </>}
                  {requestKind === "staff" && clubMode === "existing" && clubId && <>
                    <h3 className="font-semibold text-textPrimary">{t("onboarding.chooseTeam")}</h3>
                    <button type="button" onClick={() => { setTeamMode("none"); setTeamId(""); }} className={`w-full rounded-lg border p-3 text-left text-sm ${teamMode === "none" ? "border-accent bg-accentDim" : "border-borderButton"}`}>Nog geen team kiezen</button>
                    <div className="grid gap-2 sm:grid-cols-2">{teams.map((team) => <button key={team.id} type="button" onClick={() => { setTeamMode("existing"); setTeamId(team.id); }} className={`rounded-lg border p-3 text-left ${teamMode === "existing" && teamId === team.id ? "border-accent bg-accentDim" : "border-borderButton"}`}><span className="block text-sm font-semibold text-textPrimary">{team.name}</span><span className="text-xs text-textMuted">{[team.age_category, team.level_or_competition].filter(Boolean).join(" · ")}</span></button>)}</div>
                    <button type="button" onClick={() => { setTeamMode("new"); setTeamId(""); }} className={`w-full rounded-lg border p-3 text-left text-sm ${teamMode === "new" ? "border-accent bg-accentDim" : "border-borderButton"}`}>{t("onboarding.teamMissing")}</button>
                  </>}
                  {requestKind === "staff" && (clubMode === "new" || (clubMode === "existing" && teamMode === "new")) && <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm text-textSecondary">{t("onboarding.teamName")} <span className="text-textMuted">(optioneel)</span><input required={clubMode === "new"} value={teamName} onChange={(e) => setTeamName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>
                    <label className="text-sm text-textSecondary">{t("onboarding.ageOptional")}<input value={ageCategory} onChange={(e) => setAgeCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>
                    <label className="text-sm text-textSecondary">{t("onboarding.levelOptional")}<input value={levelOrCompetition} onChange={(e) => setLevelOrCompetition(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>
                  </div>}
                  {requestKind === "staff" && <><label className="block text-sm text-textSecondary">Gewenste functie (optioneel)<select value={teamRole} onChange={(e) => setTeamRole(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2"><option value="">Nog geen functie kiezen</option><option value="trainer">Trainer</option><option value="assistant_trainer">Assistent-trainer</option><option value="team_manager">Teammanager</option><option value="doctor">Dokter</option><option value="physiotherapist">Kinesist</option><option value="video_analyst">Videoanalist</option><option value="youth_coordinator">Jeugdcoördinator</option><option value="scout">Scout</option><option value="custom">Andere functie</option></select></label>{teamRole === "custom" && <label className="block text-sm text-textSecondary">Welke functie?<input required value={customRoleName} onChange={event => setCustomRoleName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label>}</>}
                  {requestKind === "contact" && <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-textSecondary">Voornaam speler<input required value={playerFirstName} onChange={event => setPlayerFirstName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label><label className="text-sm text-textSecondary">Achternaam speler<input required value={playerLastName} onChange={event => setPlayerLastName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label><label className="text-sm text-textSecondary">Geboortedatum speler<input required type="date" value={playerDateOfBirth} onChange={event => setPlayerDateOfBirth(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2" /></label><p className="text-xs text-textMuted sm:col-span-3">De clubbeheerder controleert deze gegevens en koppelt je account handmatig aan de juiste speler.</p></div>}
                  {directoryLoading && <p className="text-sm text-textMuted">{t("common.loading")}</p>}
                  {directoryError && <p className="text-sm text-amber-300">{directoryError} {t("onboarding.retryHint")}</p>}
                </fieldset>}
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
                {error && <div role="alert" aria-live="polite" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-300">
                  <strong className="block">{locale === "nl" ? "Registreren is niet gelukt" : "Registration failed"}</strong>
                  <span className="mt-1 block">{error}</span>
                </div>}
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
