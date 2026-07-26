"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LegalLinks } from "@/components/legal/LegalLinks";

export default function LoginPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read the actual form controls before changing React state. Password
    // managers can fill the DOM without firing an input/change event, leaving
    // controlled React state empty even though the user sees filled fields.
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-textMuted hover:text-accent font-mono text-xs uppercase tracking-widest mb-5">
          &larr; {t("common.backHome")}
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-4" />
          <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.coachSignIn")}</h1>
          <p className="text-textMuted text-sm mb-6">{t("auth.welcomeBackIntro")}</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label htmlFor="login-email" className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.email")}</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="coach@club.com"
                className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                required
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label htmlFor="login-password" className="block font-mono text-xs uppercase tracking-widest text-textMuted">{t("auth.password")}</label>
                <Link href="/forgot-password" className="font-mono text-xs text-accent hover:underline">{t("auth.forgotPassword")}</Link>
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.yourPassword")}
                className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent text-page rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="mt-4 text-textSecondary text-sm">
            {t("auth.noAccount")} {" "}
            <Link href="/signup" className="text-accent hover:underline font-semibold">
              {t("auth.createCoach")}
            </Link>
          </p>
        </div>

        <button
          onClick={() => setShowHelp((current) => !current)}
          className="w-full mt-4 flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-accent transition text-left"
        >
          <Image src="/branding/help.png" alt="" width={36} height={36} />
          <span className="text-textPrimary font-semibold">{t("auth.needSignInHelp")}</span>
        </button>

        {showHelp && (
          <div className="mt-2 bg-cardAlt border border-border rounded-xl p-4 text-textSecondary text-sm space-y-2">
            <p>{t("auth.confirmationHelp")}</p>
          </div>
        )}
        <div className="mt-4 flex justify-center"><LanguageSwitcher compact /></div><div className="mt-4"><LegalLinks /></div>
      </div>
    </div>
  );
}
