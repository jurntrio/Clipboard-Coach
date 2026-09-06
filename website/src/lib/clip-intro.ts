export type ClipIntro = {
  enabled: boolean;
  mode: "match" | "sponsor" | "upload";
  duration: number;
  showScore: boolean;
  score: string;
  imageUrl: string;
  sponsorLabel: string;
  sponsorName: string;
  sponsorLogoUrl: string;
};

export type IntroMatch = { teamA: string; teamB: string; logoA: string | null; logoB: string | null; score: string };

export const defaultClipIntro: ClipIntro = {
  enabled: false, mode: "match", duration: 2, showScore: false, score: "",
  imageUrl: "", sponsorLabel: "Wedstrijdsponsor", sponsorName: "", sponsorLogoUrl: ""
};

export function parseClipIntro(value: unknown): ClipIntro {
  if (!value || typeof value !== "object") throw new Error("Ongeldig introbeeld.");
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== "boolean" || !["match", "sponsor", "upload"].includes(String(v.mode)) ||
      typeof v.duration !== "number" || !Number.isFinite(v.duration) || v.duration < 0.5 || v.duration > 60 || typeof v.showScore !== "boolean") {
    throw new Error("Kies een introtype en een duur tussen 0,5 en 60 seconden.");
  }
  function field(key: string, max: number) {
    if (typeof v[key] !== "string" || (v[key] as string).length > max) throw new Error("Ongeldige tekst of afbeelding.");
    return (v[key] as string).trim();
  }
  function url(key: string) {
    const text = field(key, 2048);
    if (text && new URL(text).protocol !== "https:") throw new Error("Gebruik een beveiligde afbeeldingslink.");
    return text;
  }
  const result: ClipIntro = { enabled: v.enabled, mode: v.mode as ClipIntro["mode"], duration: v.duration,
    showScore: v.showScore, score: field("score", 30), imageUrl: url("imageUrl"),
    sponsorLabel: field("sponsorLabel", 80), sponsorName: field("sponsorName", 160), sponsorLogoUrl: url("sponsorLogoUrl") };
  if (result.enabled && result.mode === "upload" && !result.imageUrl) throw new Error("Upload eerst een afbeelding.");
  if (result.enabled && result.mode === "sponsor" && (!result.sponsorLabel || (!result.sponsorName && !result.sponsorLogoUrl))) throw new Error("Voeg een sponsornaam of sponsorlogo toe.");
  return result;
}
