"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const supabase = createClient();

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
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
          &larr; Back to home
        </Link>

        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-4" />

          {submitted ? (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">Almost there</h1>
              <p className="mt-3 text-textSecondary">Check your email to confirm your account, then sign in.</p>
              <Link href="/login" className="inline-block mt-4 text-accent hover:underline font-semibold">
                Go to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display uppercase text-2xl text-textBright">Create a coach account</h1>
              <p className="text-textMuted text-sm mb-6">Start reviewing footage in a couple of minutes.</p>

              <form onSubmit={handleSignup} className="space-y-4 text-left">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-widest text-textMuted mb-1">Full name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="w-full px-4 py-3 bg-input text-textPrimary rounded-lg border border-border"
                    required
                  />
                </div>
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
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                  {loading ? "Creating account..." : "Sign Up"}
                </button>
              </form>

              <p className="mt-4 text-textSecondary text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-accent hover:underline font-semibold">
                  Sign in
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
          <span className="text-textPrimary font-semibold">Need help?</span>
        </button>

        {showHelp && (
          <div className="mt-2 bg-cardAlt border border-border rounded-xl p-4 text-textSecondary text-sm space-y-2">
            <p>Use a real email address — you&apos;ll need to click a confirmation link before you can sign in.</p>
            <p>Password must be at least 6 characters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
