"use client";

import { useRouter } from "next/navigation";
import type { Match } from "@/types/database";
import { MatchPreparationDialog } from "./MatchPreparationDialog";
import { MatchCoreInfoEditor } from "./MatchCoreInfoEditor";

export function MatchPreparationEditor({ match, teams, canManage }: { match: Match; teams: Array<{ id: string; name: string }>; canManage: boolean }) {
  const router = useRouter();
  return <MatchPreparationDialog match={match} embedded generalInfoEditor={canManage ? <MatchCoreInfoEditor match={match} teams={teams} embedded /> : null} onClose={() => undefined} onSaved={async () => {
    router.refresh();
  }} />;
}
