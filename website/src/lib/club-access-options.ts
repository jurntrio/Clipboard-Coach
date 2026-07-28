export const CLUB_FUNCTION_ROLES = [
  ["club_admin", "Club Admin"], ["club_admin_viewer", "Club Admin (viewer)"],
  ["president", "Voorzitter"], ["board_member", "Bestuurslid"], ["secretary", "Secretaris"],
  ["treasurer", "Penningmeester"], ["youth_coordinator", "Jeugdcoördinator"],
  ["head_youth_development", "TVJO / Hoofd jeugdopleiding"], ["technical_director", "Technisch directeur"],
  ["trainer", "Trainer"], ["team_manager", "Teamafgevaardigde"], ["goalkeeper_coach", "Keeperstrainer"],
  ["video_analyst", "Videoanalist"], ["physiotherapist", "Kinesist"], ["doctor", "Dokter"],
  ["performance_coach", "Performance coach"], ["physical_coach", "Physical coach"], ["operator", "Uitbater"],
  ["equipment_manager", "Materiaalmeester"], ["scout", "Scout"],
  ["communications", "Communicatie- / persverantwoordelijke"], ["match_secretary", "Wedstrijdsecretaris"],
  ["safety_officer", "Veiligheidsverantwoordelijke"], ["head_referees", "Hoofd Scheidsrechters"],
  ["volunteer", "Vrijwilliger"], ["custom", "Aangepaste rol"]
] as const;

export const CLUB_PERMISSION_OPTIONS = [
  ["teams.view", "Teams bekijken"], ["teams.manage", "Teams en spelers beheren"], ["teams.import", "PSD/Excel importeren"],
  ["video.view", "Video Viewer gebruiken"],
  ["games.view", "Games bekijken"], ["games.create", "Wedstrijden aanmaken en aanpassen"],
  ["games.view_counts", "Kijkcijfers bekijken"], ["games.tag_link.create", "Taglink aanmaken en delen"], ["games.tag", "Wedstrijden taggen"],
  ["training.view", "Trainingen bekijken"], ["training.manage", "Trainingen toevoegen en verwijderen"],
  ["intradesk.view", "Intradesk bekijken"], ["intradesk.manage", "Intradesk-onderdelen beheren"],
  ["clips.share", "Clips delen"]
] as const;

export type ClubPermissionKey = typeof CLUB_PERMISSION_OPTIONS[number][0];
export type TeamScope = "none" | "assigned" | "selected" | "all";
