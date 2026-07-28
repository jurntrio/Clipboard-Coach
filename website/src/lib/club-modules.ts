export const CLUB_MODULES = [
  { key: "teams", label: "Teams" },
  { key: "video_viewer", label: "Video Viewer" },
  { key: "matches", label: "Wedstrijden" },
  { key: "clips", label: "Clips" },
  { key: "training", label: "Training" },
  { key: "intradesk", label: "Intradesk" },
  { key: "attendance", label: "Aanwezigheden" },
  { key: "club_management", label: "Clubbeheer" }
] as const;

export type ClubModuleKey = typeof CLUB_MODULES[number]["key"];

export const DEFAULT_CLUB_MODULES = CLUB_MODULES.map((module) => module.key);
