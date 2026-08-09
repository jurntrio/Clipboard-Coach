"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { SvsBrand } from "@/components/branding/SvsBrand";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setCheckingSession(false);
    });
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <SvsBrand className="mx-auto mb-5 w-full max-w-[320px]" priority />

          {checkingSession ? null : !hasSession ? (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.resetPasswordTitle")}</h1>
              <p className="mt-3 text-textSecondary">{t("auth.resetLinkInvalid")}</p>
              <Link href="/forgot-password" className="inline-block mt-4 text-accent hover:underline font-semibold">
                {t("auth.requestNewLink")}
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">{t("auth.resetPasswordTitle")}</h1>
              <p className="text-textMuted text-sm mb-6">{t("auth.resetPasswordIntro")}</p>

              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div>
                  <label htmlFor="reset-password" className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.newPassword")}</label>
                  <input
                    id="reset-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reset-password-confirm" className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">{t("auth.confirmPassword")}</label>
                  <input
                    id="reset-password-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
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
                  {loading ? t("auth.updatingPassword") : t("auth.updatePassword")}
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
