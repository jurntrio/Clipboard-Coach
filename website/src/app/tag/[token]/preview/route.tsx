import { ImageResponse } from "next/og";
import { loadLiveTagPage } from "@/lib/live-tag-page";
import { getMatchDisplay } from "@/lib/match-display";
import { resolveClubLogoById } from "@/lib/belgian-clubs/resolve-club-logo";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const data = await loadLiveTagPage(params.token);
  const match = data?.match;
  const display = match ? getMatchDisplay(match) : null;
  const logos = match ? await Promise.all([
    resolveClubLogoById(match.team_a_belgian_club_id, "ui"),
    resolveClubLogoById(match.team_b_belgian_club_id, "ui")
  ]) : [];
  const ordered = match?.is_home_match === false ? [...logos].reverse() : logos;
  // Embed available crests, but a missing/unreachable crest must never break sharing.
  const images = await Promise.all(ordered.map(async logo => {
    if (!logo.src) return null;
    try {
      const response = await fetch(logo.src, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      // Object storage can return application/octet-stream for a PNG crest.
      // Use the actual format; unsupported formats must not break the preview.
      const type = bytes.subarray(1, 4).toString() === "PNG" ? "image/png"
        : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg"
        : bytes.toString("utf8", 0, 256).includes("<svg") ? "image/svg+xml" : null;
      return type ? `data:${type};base64,${bytes.toString("base64")}` : null;
    } catch { return null; }
  }));
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", padding: 64, background: "#101c24", color: "white", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", color: "#66df93", fontSize: 34, marginBottom: 36 }}>SVS · LIVE TAGGEN</div>
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      {images[0] && <img src={images[0]} width={100} height={100} style={{ objectFit: "contain" }} alt="" />}
      <div style={{ display: "flex", flex: 1, fontSize: 48 }}>{display ? `${display.homeTeamName} – ${display.awayTeamName}` : "Wedstrijd taggen"}</div>
      {images[1] && <img src={images[1]} width={100} height={100} style={{ objectFit: "contain" }} alt="" />}
    </div>
    <div style={{ display: "flex", fontSize: 28, marginTop: 36 }}>{match?.match_date ?? ""}{match?.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</div>
    <div style={{ display: "flex", fontSize: 26, color: "#b5c8d3", marginTop: 26 }}>Open de link en tag wedstrijdacties live.</div>
  </div>, { width: 1200, height: 630 });
}
