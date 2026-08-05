export const CLUB_MODULES = [
  { key: "teams", label: "Teams" },
  { key: "video_viewer", label: "Video Viewer" },
  { key: "matches", label: "Wedstrijden" },
  { key: "clips", label: "Clips" },
  { key: "training", label: "Training" },
  { key: "training_builder", label: "Trainingstool (tekentool)" },
  { key: "intradesk", label: "Intradesk" },
  { key: "media", label: "Media" },
  { key: "attendance", label: "Aanwezigheden" },
  { key: "club_management", label: "Clubbeheer" }
] as const;

export type ClubModuleKey = typeof CLUB_MODULES[number]["key"];

export const DEFAULT_CLUB_MODULES = CLUB_MODULES.map((module) => module.key);

export const CLUB_FEATURE_PERMISSIONS = [
  { key: "teams_manage", module: "teams", label: "Teams en spelers beheren", description: "Teams aanpassen en spelers toevoegen, wijzigen of verwijderen." },
  { key: "teams_import", module: "teams", label: "PSD/Excel-import gebruiken", description: "Spelerslijsten vanuit een PSD- of Excelbestand importeren.", dependsOn: "teams_manage" }
] as const;

export type ClubFeaturePermissionKey = typeof CLUB_FEATURE_PERMISSIONS[number]["key"];

export const CLUB_MODULE_BUNDLES = [
  {
    key: "training",
    label: "Training",
    description: "Trainingen, tekentool en de gedeelde Intradesk-bibliotheek.",
    modules: ["training", "training_builder", "intradesk"]
  },
  {
    key: "video_analysis",
    label: "Videoanalyse",
    description: "Video Viewer, wedstrijden, tagging en clips.",
    modules: ["video_viewer", "matches", "clips"]
  },
  {
    key: "media",
    label: "Media",
    description: "ClubTV, schermen, streams, sponsoring en communicatie.",
    modules: ["media"]
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
