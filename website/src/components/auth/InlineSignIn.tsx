"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function InlineSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-36 px-3 py-2 bg-input text-textPrimary text-sm rounded-lg border border-border"
        required
      />
      <input
        type="password"
        placeholder="Password"
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
        {loading ? "..." : "Sign in"}
      </button>
      {error && <p className="w-full text-red-400 text-xs">{error}</p>}
    </form>
  );
}
