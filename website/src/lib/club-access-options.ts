export const CLUB_FUNCTION_ROLES = [
  ["club_admin", "Club Admin"], ["club_admin_viewer", "Club Admin (viewer)"],
  ["president", "Voorzitter"], ["board_member", "Bestuurslid"], ["secretary", "Secretaris"],
  ["treasurer", "Penningmeester"], ["youth_coordinator", "Jeugdcoördinator"],
  ["head_youth_development", "TVJO / Hoofd jeugdopleiding"], ["technical_director", "Technisch directeur"],
  ["trainer", "Trainer"], ["team_manager", "Teamafgevaardigde"], ["goalkeeper_coach", "Keeperstrainer"],
  ["video_analyst", "Videoanalist"], ["physiotherapist", "Kinesist"], ["doctor", "Dokter"],
  ["performance_coach", "Performance coach"], ["physical_coach", "Physical coach"], ["operator", "Medewerker horeca"],
  ["equipment_manager", "Materiaalmeester"], ["scout", "Scout"],
  ["communications", "Communicatie- / persverantwoordelijke"], ["match_secretary", "Wedstrijdsecretaris"],
  ["safety_officer", "Veiligheidsverantwoordelijke"], ["head_referees", "Hoofd Scheidsrechters"],
  ["volunteer", "Vrijwilliger"], ["custom", "Aangepaste rol"]
] as const;

export const CLUB_PERMISSION_OPTIONS = [
  ["teams.view_all", "Alle clubteams bekijken"], ["teams.manage_all", "Alle clubteams beheren"],
  ["teams.view", "Andere teams buiten de eigen ploeg(en) bekijken"], ["teams.manage", "Teams en spelers beheren"], ["teams.import", "PSD/Excel importeren"],
  ["video.view", "Video Viewer gebruiken"],
  ["games.view", "Games bekijken"], ["games.create", "Wedstrijden aanmaken en aanpassen"],
  ["games.communication.manage", "Publieke wedstrijdinfo en sponsoring beheren"],
  ["games.planning.manage", "Praktische wedstrijdplanning beheren"],
  ["games.selection.view", "Volledige wedstrijdselectie bekijken"],
  ["games.selection.manage", "Wedstrijdselectie beheren"],
  ["games.scouting.view", "Scouting bekijken"], ["games.scouting.manage", "Scouting beheren"],
  ["games.view_counts", "Kijkcijfers bekijken"], ["games.tag_link.create", "Taglink aanmaken en delen"], ["games.tag", "Wedstrijden taggen"],
  ["training.view", "Trainingen bekijken in Intradesk"], ["training.manage", "Trainingen toevoegen en versies maken"],
  ["intradesk.view", "Intradesk bekijken"], ["intradesk.manage", "Intradesk-onderdelen beheren"],
  ["clips.share", "Clips delen"]
] as const;

export const CLUB_PERMISSION_DESCRIPTIONS: Record<ClubPermissionKey, string> = {
  "teams.view_all": "Geeft toegang tot alle teams van de club, ook wanneer iemand er niet aan toegewezen is.",
  "teams.manage_all": "Geeft toestemming om alle teams en spelers van de club te beheren. Dit schakelt automatisch ‘Alle clubteams bekijken’ en ‘Teams en spelers beheren’ in.",
  "teams.view": "Laat toe om expliciet gekozen ploegen buiten de eigen/toegewezen ploegen te bekijken.",
  "teams.manage": "De eigen/toegewezen en eventueel extra toegankelijke teams aanpassen en daar spelers toevoegen, wijzigen of verwijderen. Bij toegang tot alle teams geldt dit voor alle clubteams.",
  "teams.import": "Spelerslijsten vanuit PSD of Excel inlezen in een team dat je mag beheren. Dit vereist ook ‘Teams en spelers beheren’.",
  "video.view": "De Video Viewer openen en wedstrijdbeelden binnen de toegankelijke ploegen bekijken.",
  "games.view": "Geeft toegang tot Games: wedstrijden, tags en clips van de eigen/toegewezen of extra toegankelijke ploegen bekijken.",
  "games.create": "Wedstrijden aanmaken en aanpassen voor de eigen/toegewezen en eventueel extra toegankelijke ploegen. Wie toegang tot alle teams heeft, kan dit voor alle clubteams.",
  "games.communication.manage": "Publieke wedstrijdinformatie, uitslag, locatie en de sponsor van gedeelde wedstrijdclips beheren.",
  "games.planning.manage": "Per wedstrijd de afspraak, locatie, kleedkamers, het veld en de scheidsrechter selecteren uit de clubinstellingen.",
  "games.selection.view": "De volledige selectie bekijken. Ouders zien hiermee niet automatisch andere spelers.",
  "games.selection.manage": "De selectie beheren, inclusief rugnummers, redenen en interne notities.",
  "games.scouting.view": "Interne scoutingobservaties bij wedstrijden van toegankelijke ploegen bekijken.",
  "games.scouting.manage": "Interne scoutingobservaties bij wedstrijden van toegankelijke ploegen toevoegen en aanpassen.",
  "games.view_counts": "Bekijken hoe vaak gedeelde clips geopend werden.",
  "games.tag_link.create": "Een eenmalige of gedeelde link maken waarmee iemand een wedstrijd kan taggen.",
  "games.tag": "Tijdens of na een wedstrijd tags en momenten toevoegen of aanpassen.",
  "training.view": "Gepubliceerde trainingen van de club en de toegankelijke ploegen in Intradesk bekijken.",
  "training.manage": "Persoonlijke trainingen toevoegen en bewerken. Bij wijziging van een gepubliceerde training wordt een nieuwe Intradesk-versie gemaakt, eventueel eerst ter goedkeuring volgens de clubinstellingen.",
  "intradesk.view": "De gedeelde trainingsbibliotheek van de club bekijken.",
  "intradesk.manage": "Onderdelen, trainingen en versies in Intradesk toevoegen of beheren.",
  "clips.share": "Clips van de eigen of expliciet toegankelijke ploegen delen."
};

export type ClubPermissionKey = typeof CLUB_PERMISSION_OPTIONS[number][0];
export type TeamScope = "none" | "assigned" | "all";

export function defaultPermissionsForRole(role: string): ClubPermissionKey[] {
  if (role === "club_admin") return CLUB_PERMISSION_OPTIONS.map(([key]) => key);
  if (role === "club_admin_viewer") return ["teams.view", "video.view", "games.view", "games.view_counts", "training.view", "intradesk.view"];
  if (role === "trainer" || role === "goalkeeper_coach") {
    return ["video.view", "games.view", "games.planning.manage", "games.selection.view", "games.selection.manage", "games.tag_link.create", "games.tag", "training.view", "intradesk.view", "clips.share"];
  }
  if (role === "video_analyst") return ["video.view", "games.view", "games.view_counts", "games.tag", "intradesk.view", "clips.share"];
  if (role === "scout") return ["games.view", "games.scouting.view", "games.scouting.manage"];
  if (role === "communications") return ["games.view", "games.communication.manage", "clips.share"];
  return ["intradesk.view"];
}
