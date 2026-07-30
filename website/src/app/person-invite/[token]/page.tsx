"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LEGAL_STATEMENT_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/client";

export default function PersonInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setLoading(false);
    });
  }, []);

  async function claimExistingAccount() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/person-invitations/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) return setError(body.error || "De uitnodiging kon niet worden gekoppeld.");
    setSubmitted(true);
  }

  async function signup(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) return;
    setLoading(true);
    setError("");
    const { error: signupError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          person_invite_token: token,
          legal_accepted: true,
          legal_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          legal_statement_version: LEGAL_STATEMENT_VERSION,
          legal_locale: "nl"
        }
      }
    });
    setLoading(false);
    if (signupError) {
      return setError(
        signupError.message.includes("Database error")
          ? "Deze uitnodiging is ongeldig, verlopen, al gebruikt of hoort bij een ander e-mailadres."
          : signupError.message
      );
    }
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <Image
          src="/branding/banner.png"
          alt="Clipboard Coach Studio"
          width={280}
          height={90}
          className="mx-auto mb-5"
        />
        <h1 className="text-2xl font-bold text-textBright">Persoonlijk account activeren</h1>
        <p className="mt-2 text-sm text-textMuted">
          Deze persoonlijke link koppelt je account veilig aan je bestaande clubgegevens en kan maar
          één keer gebruikt worden.
        </p>

        {submitted ? (
          <div className="mt-6 text-center">
            <h2 className="text-xl font-bold text-textBright">
              {signedIn ? "Account gekoppeld" : "Controleer je e-mail"}
            </h2>
            <p className="mt-2 text-textSecondary">
              {signedIn
                ? "Je clubgegevens zijn voortaan aan dit account verbonden."
                : "Bevestig je e-mailadres om je registratie af te ronden."}
            </p>
          </div>
        ) : signedIn ? (
          <button
            type="button"
            disabled={loading}
            onClick={claimExistingAccount}
            className="mt-6 w-full rounded-lg bg-accent py-3 font-bold text-page disabled:opacity-50"
          >
            Koppel aan mijn aangemelde account
          </button>
        ) : (
          <form onSubmit={signup} className="mt-6 space-y-4">
            <label className="block text-sm text-textSecondary">
              E-mail
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-textSecondary">
              Wachtwoord
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-textSecondary">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1"
              />
              <span>
                Ik ga akkoord met de{" "}
                <Link href="/terms" target="_blank" className="text-accent">
                  Gebruiksvoorwaarden
                </Link>{" "}
                en de{" "}
                <Link href="/privacy" target="_blank" className="text-accent">
                  Privacyverklaring
                </Link>
                .
              </span>
            </label>
            <button
              disabled={loading || !accepted}
              className="w-full rounded-lg bg-accent py-3 font-bold text-page disabled:opacity-50"
            >
              Registreren en koppelen
            </button>
          </form>
        )}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-input px-3 py-3 text-textPrimary";
