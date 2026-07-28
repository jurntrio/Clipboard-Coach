"use client";

import { useActiveClub } from "./ActiveClubProvider";

export function ActiveClubBar() {
  const { clubs, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  if (!clubs.length) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-textMuted">
            {isPlatformAdmin ? "Algemene Admin · actieve club" : "Actieve club"}
          </p>
          <p className="text-sm text-textSecondary">Alle clubgegevens worden binnen deze club getoond.</p>
        </div>
        <select
          aria-label="Actieve club"
          value={activeClubId ?? ""}
          disabled={changing}
          onChange={(event) => void selectClub(event.target.value)}
          className="min-w-56 rounded-xl border border-borderButton bg-button px-4 py-2.5 font-semibold text-textPrimary disabled:opacity-60"
        >
          {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </div>
    </div>
  );
}

