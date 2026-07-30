import Link from "next/link";
import type { Match } from "@/types/database";

export function MatchPreparationButton({ match }: { match: Match; initialOpen?: boolean }) {
  return <Link href={`/dashboard/games/${match.id}/preparation`} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">
    Wedstrijdvoorbereiding
  </Link>;
}
