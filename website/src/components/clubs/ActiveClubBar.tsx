"use client";

import Image from "next/image";
import Link from "next/link";
import { useActiveClub } from "./ActiveClubProvider";

export function ActiveClubBar() {
  const { clubs, activeClub, activeClubId, isPlatformAdmin, changing, selectClub } = useActiveClub();
  const showClubSelector = isPlatformAdmin || clubs.length > 1;

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link
          href="/dashboard"
          title="Home"
          aria-label="Home"
          className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover"
        >
          <Image src="/branding/home.png" alt="" width={30} height={30} />
        </Link>
        {activeClub?.logoUrl ? (
          <Image
            src={activeClub.logoUrl}
            alt={`${activeClub.name} logo`}
            title={activeClub.name}
            width={52}
            height={52}
            unoptimized
            className="h-[52px] w-[52px] shrink-0 rounded-xl border border-borderButton bg-white object-contain"
          />
        ) : (
          <div
            aria-label="Geen clublogo"
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-borderButton bg-white p-1 text-center text-[8px] font-bold uppercase leading-tight text-[#7a857f]"
          >
            Geen logo
          </div>
        )}
        {showClubSelector && (
          <select
            aria-label="Actieve club"
            value={activeClubId ?? ""}
            disabled={changing}
            onChange={(event) => void selectClub(event.target.value)}
            className="h-[52px] min-w-0 max-w-72 rounded-xl border border-borderButton bg-button px-4 font-semibold text-textPrimary disabled:opacity-60"
          >
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
