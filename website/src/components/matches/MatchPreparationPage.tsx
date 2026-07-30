"use client";

import { useRouter } from "next/navigation";
import type { Match } from "@/types/database";
import { MatchPreparationDialog } from "./MatchPreparationDialog";

export function MatchPreparationPage({ match }: { match: Match }) {
  const router = useRouter();
  return <MatchPreparationDialog match={match} embedded onClose={() => router.back()} onSaved={async () => {
    router.push(`/dashboard/games/${match.id}`);
    router.refresh();
  }} />;
}
