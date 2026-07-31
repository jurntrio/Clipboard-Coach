"use client";

import { useRouter } from "next/navigation";
import type { Match } from "@/types/database";
import { MatchPreparationDialog } from "./MatchPreparationDialog";

export function MatchPreparationEditor({ match }: { match: Match }) {
  const router = useRouter();
  return <MatchPreparationDialog match={match} embedded onClose={() => undefined} onSaved={async () => {
    router.refresh();
  }} />;
}
