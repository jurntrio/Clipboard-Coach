import Image from "next/image";

export type ClubLogoData =
  | { src: string; quality: "large" | "small" }
  | { src: null; quality: "missing" };

// "ui" (match lists, calendar, mobile, admin, ...) always renders small.
// "display" (ClubTV, matchposter, line-up) renders large logos big, but caps
// a small-quality fallback well below that so it's never blown up and blurry.
const MAX_SIZE_PX: Record<"ui" | "display", Record<"large" | "small", number>> = {
  ui: { large: 40, small: 40 },
  display: { large: 280, small: 110 }
};

// Pure presentational piece, deliberately kept free of any server-only
// import: ClubLogo (a server component) uses it after resolving the logo
// itself, and client components (e.g. the Wedstrijden list) use it directly
// with logo data that arrived pre-resolved from an API route, since they
// can't call the DB-backed resolver themselves.
export function ClubLogoImage({
  logo,
  naam,
  purpose,
  className
}: {
  logo: ClubLogoData;
  naam?: string;
  purpose: "ui" | "display";
  className?: string;
}) {
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
