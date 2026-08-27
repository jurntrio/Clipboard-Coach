"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export function ErrorFallback({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    void fetch("/api/monitoring/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: error.message, digest: error.digest, route: window.location.pathname }) }).catch(() => undefined);
  }, [error]);
  return <main className="grid min-h-screen place-items-center bg-page p-6 text-center text-textPrimary"><div className="max-w-md rounded-xl border border-border bg-cardAlt p-6"><h1 className="text-xl font-bold text-textBright">Er ging iets mis</h1><p className="mt-2 text-sm text-textMuted">De fout werd automatisch gemeld. Probeer de pagina opnieuw.</p><button type="button" onClick={reset} className="mt-5 rounded-lg bg-accent px-4 py-2 font-semibold text-page">Opnieuw proberen</button></div></main>;
}
