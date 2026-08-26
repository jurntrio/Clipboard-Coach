"use client";
import { ErrorFallback } from "@/components/monitoring/ErrorFallback";
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) { return <html lang="nl"><body><ErrorFallback {...props} /></body></html>; }
