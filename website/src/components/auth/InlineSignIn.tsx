"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";

export function InlineSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <form onSubmit={handleSubmit} className="relative flex flex-nowrap items-center gap-2">
      <input
        type="email"
        placeholder={t("auth.inlineEmail")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-36 px-3 py-2 bg-input text-textPrimary text-sm rounded-lg border border-border"
        required
      />
      <input
        type="password"
        placeholder={t("auth.inlinePassword")}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-32 px-3 py-2 bg-input text-textPrimary text-sm rounded-lg border border-border"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-accent text-page text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {loading ? t("auth.signingIn") : t("auth.signIn")}
      </button>
      <Link href="/forgot-password" className="whitespace-nowrap text-xs text-accent hover:underline">{t("auth.forgotPassword")}</Link>
      {error && <p className="absolute right-0 top-full mt-1 max-w-full text-right text-xs text-red-400">{error}</p>}
    </form>
  );
}
