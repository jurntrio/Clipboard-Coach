"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/types/database";
import { MatchPreparationDialog } from "@/components/matches/MatchPreparationDialog";

export function MatchPreparationButton({ match }: { match: Match }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-borderButton px-3 py-1.5 text-xs font-bold text-accent">
      Aanpassen
    </button>
    {open && <MatchPreparationDialog match={match} onClose={() => setOpen(false)} onSaved={async () => router.refresh()} />}
  </>;
}
