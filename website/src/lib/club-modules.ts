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

export const CLUB_MODULE_BUNDLES = [
  {
    key: "training",
    label: "Training",
    description: "Trainingen, tekentool en de gedeelde Intradesk-bibliotheek.",
    modules: ["training", "intradesk"]
  },
  {
    key: "video_analysis",
    label: "Videoanalyse",
    description: "Video Viewer, wedstrijden, tagging en clips.",
    modules: ["video_viewer", "matches", "clips"]
  },
  {
    key: "club_teams",
    label: "Club & Teams",
    description: "Teams, leden, clubbeheer en aanwezigheden.",
    modules: ["teams", "club_management", "attendance"]
  }
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  modules: readonly ClubModuleKey[];
}>;

export type ClubModuleBundleKey = typeof CLUB_MODULE_BUNDLES[number]["key"];
