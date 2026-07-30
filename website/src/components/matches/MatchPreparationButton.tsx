"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/types/database";
import { MatchPreparationDialog } from "@/components/matches/MatchPreparationDialog";

export function MatchPreparationButton({ match, initialOpen = false }: { match: Match; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const router = useRouter();
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-borderButton px-3 py-1.5 text-xs font-bold text-accent">
      Voorbereiding bewerken
    </button>
    {open && <MatchPreparationDialog match={match} onClose={() => setOpen(false)} onSaved={async () => router.refresh()} />}
  </>;
}
