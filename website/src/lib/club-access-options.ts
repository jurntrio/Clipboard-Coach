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
  ["commercial_manager", "Commercieel verantwoordelijke"], ["sponsor_viewer", "Sponsorviewer"],
  ["safety_officer", "Veiligheidsverantwoordelijke"], ["head_referees", "Hoofd Scheidsrechters"],
  ["volunteer", "Vrijwilliger"], ["custom", "Aangepaste rol"]
] as const;

export const CLUB_PERMISSION_OPTIONS = [
  ["teams.view_all", "Alle clubteams bekijken"], ["teams.manage_all", "Alle clubteams beheren"],
  ["teams.view", "Andere teams buiten de eigen ploeg(en) bekijken"], ["teams.manage", "Teams en spelers beheren"], ["teams.import", "PSD/Excel importeren"],
  ["video.view", "Video Viewer gebruiken"],
  ["games.view", "Games bekijken"], ["games.create", "Wedstrijden aanmaken en aanpassen"],
  ["games.video_sources.manage", "Wedstrijdbeelden beheren"],
  ["games.communication.manage", "Publieke wedstrijdinfo en sponsoring beheren"],
  ["games.planning.manage", "Praktische wedstrijdplanning beheren"],
  ["games.selection.view", "Volledige wedstrijdselectie bekijken"],
  ["games.selection.manage", "Wedstrijdselectie beheren"],
  ["games.report.view", "Wedstrijdverslag bekijken"], ["games.report.manage", "Wedstrijdverslag beheren"],
  ["games.scouting.view", "Scouting bekijken"], ["games.scouting.manage", "Scouting beheren"],
  ["games.view_counts", "Kijkcijfers bekijken"], ["games.tag_link.create", "Taglink aanmaken en delen"], ["games.tag", "Wedstrijden taggen"],
  ["training.view", "Trainingen bekijken in Intradesk"], ["training.manage", "Trainingen toevoegen en versies maken"],
  ["intradesk.view", "Intradesk bekijken"], ["intradesk.manage", "Intradesk-onderdelen beheren"],
  ["sponsors.view", "Sponsors bekijken"], ["sponsors.manage", "Sponsors beheren"],
  ["sponsors.assets.manage", "Sponsorassets beheren"],
  ["sponsors.internal.view", "Interne sponsorgegevens bekijken"], ["sponsors.internal.manage", "Interne sponsorgegevens beheren"],
  ["sponsors.scopes.view", "Sponsorbereiken bekijken"], ["sponsors.scopes.manage", "Sponsorbereiken en teamkoppelingen beheren"],
  ["sponsors.assignments.manage", "Sponsortoewijzingen beheren"],
  ["sponsors.teams.manage", "Teamsponsors en Teamaccenten beheren"],
  ["sponsors.matches.view", "Wedstrijdsponsoring bekijken"], ["sponsors.matches.manage", "Wedstrijdsponsoring beheren"],
  ["clips.share", "Clips delen"]
  ,["injuries.view", "Blessurestatus en historiek bekijken"], ["injuries.manage", "Blessures registreren en aanpassen"]
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
  "games.video_sources.manage": "Video's, 360SI-opnames, camera's en externe videolinks toevoegen, aanpassen of verwijderen voor toegankelijke wedstrijden.",
  "games.communication.manage": "Publieke wedstrijdinformatie, uitslag, locatie en de sponsor van gedeelde wedstrijdclips beheren.",
  "games.planning.manage": "Per wedstrijd de afspraak, locatie, kleedkamers, het veld en de scheidsrechter selecteren uit de clubinstellingen.",
  "games.selection.view": "De volledige selectie bekijken. Ouders zien hiermee niet automatisch andere spelers.",
  "games.selection.manage": "De selectie beheren, inclusief rugnummers, redenen en interne notities.",
  "games.report.view": "Interne wedstrijdverslagen, analyses en doelpuntdetails van toegankelijke ploegen bekijken.",
  "games.report.manage": "Interne wedstrijdverslagen, analyses en doelpuntdetails van toegankelijke ploegen toevoegen en aanpassen.",
  "games.scouting.view": "Interne scoutingobservaties bij wedstrijden van toegankelijke ploegen bekijken.",
  "games.scouting.manage": "Interne scoutingobservaties bij wedstrijden van toegankelijke ploegen toevoegen en aanpassen.",
  "games.view_counts": "Bekijken hoe vaak gedeelde clips geopend werden.",
  "games.tag_link.create": "Een eenmalige of gedeelde link maken waarmee iemand een wedstrijd kan taggen.",
  "games.tag": "Tijdens of na een wedstrijd tags en momenten toevoegen of aanpassen.",
  "training.view": "Gepubliceerde trainingen van de club en de toegankelijke ploegen in Intradesk bekijken.",
  "training.manage": "Persoonlijke trainingen toevoegen en bewerken. Bij wijziging van een gepubliceerde training wordt een nieuwe Intradesk-versie gemaakt, eventueel eerst ter goedkeuring volgens de clubinstellingen.",
  "intradesk.view": "De gedeelde trainingsbibliotheek van de club bekijken.",
  "intradesk.manage": "Onderdelen, trainingen en versies in Intradesk toevoegen of beheren.",
  "sponsors.view": "Centrale sponsorfiches en hun publieke, operationele gegevens bekijken.",
  "sponsors.manage": "Centrale sponsorfiches aanmaken, aanpassen, activeren en deactiveren.",
  "sponsors.assets.manage": "Logo's en andere media-assets van sponsors uploaden en beheren.",
  "sponsors.internal.view": "Afgeschermde contactgegevens en interne operationele sponsornotities bekijken.",
  "sponsors.internal.manage": "Afgeschermde contactgegevens en interne operationele sponsornotities aanpassen.",
  "sponsors.scopes.view": "Sponsorbereiken en de gekoppelde teams bekijken.",
  "sponsors.scopes.manage": "Sponsorbereiken aanmaken en teams per seizoen eraan koppelen.",
  "sponsors.assignments.manage": "Seizoens- of periodegebonden sponsortoewijzingen en sponsorniveaus beheren.",
  "sponsors.teams.manage": "Specifieke Teamsponsors en Teamaccenten beheren.",
  "sponsors.matches.view": "De commerciële werklijst en sponsoring van thuiswedstrijden bekijken.",
  "sponsors.matches.manage": "Speciale thuiswedstrijden selecteren en wedstrijdsponsors of matchbalschenkers beheren.",
  "clips.share": "Clips van de eigen of expliciet toegankelijke ploegen delen."
  ,"injuries.view": "Sportief relevante blessurestatus en historiek van toegankelijke spelers bekijken.",
  "injuries.manage": "Spelers als geblesseerd registreren, updates toevoegen en opnieuw beschikbaar verklaren."
};

export type ClubPermissionKey = typeof CLUB_PERMISSION_OPTIONS[number][0];
export type TeamScope = "none" | "assigned" | "all";

export function defaultPermissionsForRole(role: string): ClubPermissionKey[] {
  if (role === "club_admin") return CLUB_PERMISSION_OPTIONS.map(([key]) => key);
  if (role === "club_admin_viewer") return ["teams.view", "video.view", "games.view", "games.view_counts", "training.view", "intradesk.view"];
  if (role === "trainer") {
    return ["teams.view", "video.view", "games.view", "games.create", "games.video_sources.manage", "games.planning.manage", "games.selection.view", "games.selection.manage", "games.tag_link.create", "games.tag", "training.view", "training.manage", "intradesk.view", "injuries.view", "clips.share"];
  }
  if (role === "goalkeeper_coach") {
    return ["teams.view", "training.view", "intradesk.view"];
  }
  if (role === "team_manager") return ["teams.view", "games.view", "games.selection.view", "training.view", "intradesk.view"];
  if (role === "video_analyst") return ["teams.view", "video.view", "games.view", "games.video_sources.manage", "games.view_counts", "games.tag", "training.view", "intradesk.view", "clips.share"];
  if (role === "scout") return ["teams.view", "games.view", "training.view", "intradesk.view", "games.scouting.view", "games.scouting.manage"];
  if (role === "communications") return ["teams.view", "games.view", "training.view", "intradesk.view", "games.communication.manage", "clips.share"];
  if (role === "commercial_manager") return [
    "sponsors.view", "sponsors.manage", "sponsors.assets.manage",
    "sponsors.internal.view", "sponsors.internal.manage",
    "sponsors.scopes.view", "sponsors.scopes.manage", "sponsors.assignments.manage",
    "sponsors.teams.manage", "sponsors.matches.view", "sponsors.matches.manage"
  ];
  if (role === "sponsor_viewer") return ["sponsors.view", "sponsors.scopes.view", "sponsors.matches.view"];
  if (role === "doctor" || role === "physiotherapist") return ["teams.view", "injuries.view", "injuries.manage"];
  if (["youth_coordinator", "head_youth_development", "technical_director"].includes(role)) return ["teams.view", "teams.view_all", "teams.manage", "teams.manage_all", "teams.import", "games.view", "training.view", "training.manage", "intradesk.view", "injuries.view", "injuries.manage"];
  if (role === "assistant_trainer") return ["teams.view", "video.view", "games.view", "games.video_sources.manage", "games.planning.manage", "games.selection.view", "games.selection.manage", "games.tag_link.create", "games.tag", "training.view", "training.manage", "intradesk.view", "injuries.view", "clips.share"];
  if (role === "team_manager") return ["teams.view", "injuries.view"];
  return ["teams.view", "games.view", "training.view", "intradesk.view"];
}
