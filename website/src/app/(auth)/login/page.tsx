"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(event: React.FormEvent) {
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
    <div className="min-h-screen flex items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-textMuted hover:text-accent font-mono text-xs uppercase tracking-widest mb-5">
          &larr; Back to home
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-4" />
          <h1 className="font-display uppercase text-2xl text-textBright">Coach sign in</h1>
          <p className="text-textMuted text-sm mb-6">Welcome back. Pick up where you left off.</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">Email</label>
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
              <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-textSecondary text-sm">
            No account?{" "}
            <Link href="/signup" className="text-accent hover:underline font-semibold">
              Create a coach account
            </Link>
          </p>
        </div>

        <button
          onClick={() => setShowHelp((current) => !current)}
          className="w-full mt-4 flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-accent transition text-left"
        >
          <Image src="/branding/help.png" alt="" width={36} height={36} />
          <span className="text-textPrimary font-semibold">Need help signing in?</span>
        </button>

        {showHelp && (
          <div className="mt-2 bg-cardAlt border border-border rounded-xl p-4 text-textSecondary text-sm space-y-2">
            <p>Didn&apos;t get the confirmation email? Check your spam folder — it comes from Supabase.</p>
            <p>Forgot your password? Password reset isn&apos;t wired up yet — ask whoever set up your account to reset it from the Supabase dashboard for now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
