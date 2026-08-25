"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { SvsBrand } from "@/components/branding/SvsBrand";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-1 text-textMuted hover:text-accent font-mono text-xs uppercase tracking-widest mb-5">
          &larr; {t("auth.backToLogin")}
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <SvsBrand className="mx-auto mb-5 w-full max-w-[320px]" priority />

          {sent ? (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.resetLinkSent")}</h1>
              <p className="mt-3 text-textSecondary">{t("auth.resetLinkSentIntro")}</p>
              <Link href="/login" className="inline-block mt-4 text-accent hover:underline font-semibold">
                {t("auth.backToLogin")}
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.forgotPasswordTitle")}</h1>
              <p className="text-textMuted text-sm mb-6">{t("auth.forgotPasswordIntro")}</p>

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <label htmlFor="forgot-email" className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.email")}</label>
                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="coach@club.com"
                    className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                    required
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-accent text-page rounded-lg font-bold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? t("auth.sendingResetLink") : t("auth.sendResetLink")}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-center"><LanguageSwitcher compact /></div><div className="mt-4"><LegalLinks /></div>
      </div>
    </div>
  );
}
