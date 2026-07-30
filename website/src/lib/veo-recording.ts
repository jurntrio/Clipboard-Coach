const VEO_MATCH_HOST = "app.veo.co";
const VEO_VIDEO_HOST = "c.veocdn.com";
const VEO_MATCH_PATH = /^\/matches\/([a-z0-9][a-z0-9-]{2,120})\/?$/i;

type VeoVideo = {
  availability?: string | null;
  mime_type?: string | null;
  render_type?: string | null;
  url?: string | null;
};

export type ResolvedVeoRecording = {
  matchSlug: string;
  sourceUrl: string;
  startOffsetSeconds: number;
};

export function parseVeoMatchUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Ongeldige Veo-link.");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== VEO_MATCH_HOST) {
    throw new Error("Gebruik een publieke wedstrijdlink van app.veo.co.");
  }
  const match = url.pathname.match(VEO_MATCH_PATH);
  if (!match) throw new Error("Deze Veo-link verwijst niet naar een wedstrijd.");
  return {
    matchSlug: match[1],
    startOffsetSeconds: parseVeoTimeFragment(url.hash)
  };
}

export async function resolveVeoRecording(rawUrl: string): Promise<ResolvedVeoRecording> {
  const parsed = parseVeoMatchUrl(rawUrl);
  const response = await fetch(`https://${VEO_MATCH_HOST}/api/app/matches/${encodeURIComponent(parsed.matchSlug)}/videos/`, {
    headers: { Accept: "application/json", "Veo-App-Id": "hazard", "veo-agent": "clipboard-coach" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    throw new Error(response.status === 404
      ? "De Veo-wedstrijd werd niet gevonden."
      : "Veo kon de videobron niet beschikbaar maken.");
  }
  const videos = await response.json() as VeoVideo[];
  const standard = videos.find((video) =>
    video.render_type === "standard"
    && video.mime_type === "video/mp4"
    && video.availability !== "archived"
    && typeof video.url === "string"
  );
  if (!standard?.url) throw new Error("Voor deze Veo-wedstrijd is geen beschikbare follow-camvideo gevonden.");

  const source = new URL(standard.url);
  if (source.protocol !== "https:" || source.hostname.toLowerCase() !== VEO_VIDEO_HOST || !source.pathname.endsWith(".mp4")) {
    throw new Error("Veo gaf een onverwachte videobron terug.");
  }
  return { ...parsed, sourceUrl: source.toString() };
}

function parseVeoTimeFragment(hash: string) {
  const raw = hash.replace(/^#t=/i, "").trim();
  if (!raw || raw === hash) return 0;
  const parts = raw.split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 1) return Math.floor(parts[0]);
  if (parts.length === 2 && parts[1] < 60) return Math.floor(parts[0] * 60 + parts[1]);
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) {
    return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return 0;
}
