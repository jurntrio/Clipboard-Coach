import Image from "next/image";
import { resolveClubLogo } from "@/lib/belgian-clubs/resolve-club-logo";

// "ui" (match lists, calendar, mobile, admin, ...) always renders small.
// "display" (ClubTV, matchposter, line-up) renders large logos big, but caps
// a small-quality fallback well below that so it's never blown up and blurry.
const MAX_SIZE_PX: Record<"ui" | "display", Record<"large" | "small", number>> = {
  ui: { large: 40, small: 40 },
  display: { large: 280, small: 110 }
};

export async function ClubLogo({
  stamnummer,
  naam,
  purpose,
  className
}: {
  stamnummer: number | null | undefined;
  naam?: string;
  purpose: "ui" | "display";
  className?: string;
}) {
  const logo = await resolveClubLogo(stamnummer, purpose);

  if (logo.quality === "missing") {
    return <span aria-hidden className={className} />;
  }

  const maxSize = MAX_SIZE_PX[purpose][logo.quality];

  return (
    <Image
      src={logo.src}
      alt={naam ? `Logo ${naam}` : "Clublogo"}
      width={maxSize}
      height={maxSize}
      unoptimized
      className={`object-contain ${className ?? ""}`}
      style={{ maxWidth: maxSize, maxHeight: maxSize, width: "auto", height: "auto" }}
    />
  );
}
