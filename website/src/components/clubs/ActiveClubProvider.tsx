"use client";

import { createContext, useContext, useState } from "react";
import type { AvailableClub } from "@/lib/auth/active-club";

type ActiveClubContextValue = {
  clubs: AvailableClub[];
  activeClubId: string | null;
  activeClub: AvailableClub | null;
  isPlatformAdmin: boolean;
  changing: boolean;
  selectClub: (clubId: string) => Promise<void>;
};

const ActiveClubContext = createContext<ActiveClubContextValue | null>(null);

export function ActiveClubProvider({ clubs, initialClubId, isPlatformAdmin, children }: {
  clubs: AvailableClub[];
  initialClubId: string | null;
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}) {
  const [activeClubId, setActiveClubId] = useState(initialClubId);
  const [changing, setChanging] = useState(false);

  async function selectClub(clubId: string) {
    if (clubId === activeClubId) return;
    setChanging(true);
    const response = await fetch("/api/club-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId })
    });
    if (!response.ok) {
      setChanging(false);
      throw new Error("Club kon niet worden geselecteerd.");
    }
    setActiveClubId(clubId);
    window.location.reload();
  }

  return (
    <ActiveClubContext.Provider value={{
      clubs,
      activeClubId,
      activeClub: clubs.find((club) => club.id === activeClubId) ?? null,
      isPlatformAdmin,
      changing,
      selectClub
    }}>
      {children}
    </ActiveClubContext.Provider>
  );
}

export function useActiveClub() {
  const context = useContext(ActiveClubContext);
  if (!context) throw new Error("useActiveClub must be used inside ActiveClubProvider");
  return context;
}

