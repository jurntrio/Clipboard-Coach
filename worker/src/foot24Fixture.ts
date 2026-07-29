function cleanSummary(summary: string) {
  return summary.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+/g, " ").trim();
}

function normalizeTeamName(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function isFixtureForClub(summary: string, clubName: string) {
  const cleaned = cleanSummary(summary);
  if (/brochure|tornooivoetbal|jeugdtoernooien|update (?:voetbal)?kalender/i.test(cleaned)) return false;
  const parts = cleaned.split(/\s+(?:-|–|—|vs?\.?|tegen)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  const clubKey = normalizeTeamName(clubName);
  return !!clubKey && parts.some((part) => normalizeTeamName(part).includes(clubKey));
}
