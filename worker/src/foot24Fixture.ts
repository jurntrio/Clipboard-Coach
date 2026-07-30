function cleanSummary(summary: string) {
  return summary.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+/g, " ").trim();
}

function normalizeTeamName(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

const HOME_MARKER = /(?:\u26bd|\u{1f535}|âš½)/giu;

function hasHomeMarker(value: string) {
  HOME_MARKER.lastIndex = 0;
  return HOME_MARKER.test(value);
}

function withoutHomeMarker(value: string) {
  return value.replace(HOME_MARKER, "").replace(/\s+/g, " ").trim();
}

export function mappedFoot24Fixture(summary: string, teamName: string, clubName: string) {
  const parts = summary.replace(/\s+/g, " ").trim()
    .split(/\s+(?:-|â€“|â€”|vs?\.?|tegen)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const source = parts.length >= 2
    ? { home: parts[0], away: parts.slice(1).join(" - ") }
    : { home: teamName, away: summary };
  const markerOnHome = hasHomeMarker(source.home);
  const markerOnAway = hasHomeMarker(source.away);
  const home = withoutHomeMarker(markerOnAway && !markerOnHome ? source.away : source.home) || teamName;
  const away = withoutHomeMarker(markerOnAway && !markerOnHome ? source.home : source.away) || teamName;
  const clubKey = normalizeTeamName(clubName);
  const teamKey = normalizeTeamName(teamName);
  const homeIsTeam = normalizeTeamName(home).includes(teamKey) || teamKey.includes(normalizeTeamName(home));
  const awayIsTeam = normalizeTeamName(away).includes(teamKey) || teamKey.includes(normalizeTeamName(away));
  const homeIsClub = homeIsTeam || (!awayIsTeam && normalizeTeamName(home).includes(clubKey));
  const awayIsClub = awayIsTeam || (!homeIsTeam && normalizeTeamName(away).includes(clubKey));
  return { home, away, isHome: homeIsClub || !awayIsClub };
}

export function isFixtureForClub(summary: string, clubName: string) {
  const cleaned = cleanSummary(summary);
  if (/brochure|tornooivoetbal|jeugdtoernooien|update (?:voetbal)?kalender/i.test(cleaned)) return false;
  const parts = cleaned.split(/\s+(?:-|–|—|vs?\.?|tegen)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  const clubKey = normalizeTeamName(clubName);
  return !!clubKey && parts.some((part) => normalizeTeamName(part).includes(clubKey));
}
