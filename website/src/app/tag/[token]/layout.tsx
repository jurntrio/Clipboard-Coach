import type { Metadata } from "next";
import { loadLiveTagPage } from "@/lib/live-tag-page";
import { getMatchDisplay } from "@/lib/match-display";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const data = await loadLiveTagPage(params.token);
  const match = data?.match;
  const display = match ? getMatchDisplay({ ...match, score_a: null, score_b: null }) : null;
  const title = display ? `Live taggen · ${display.homeTeamName} – ${display.awayTeamName}` : "Live taggen | Sport Visual Systems";
  const date = match?.match_date ? new Intl.DateTimeFormat("nl-BE").format(new Date(`${match.match_date}T12:00:00`)) : "";
  const description = match ? `Tag wedstrijdacties live${date ? ` op ${date}` : ""}${match.start_time ? ` om ${match.start_time.slice(0, 5)}` : ""}. Open de link en tik op een tag om een moment te registreren.` : "Open deze link om wedstrijdacties live te taggen.";
  return {
    title, description, robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "Sport Visual Systems", images: [{ url: `/tag/${params.token}/preview`, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary", title, description }
  };
}

export default function TagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
