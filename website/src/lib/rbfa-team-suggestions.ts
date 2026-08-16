export type RbfaSuggestionTeam = {
  id: string;
  name: string;
  display_order: number;
  age_category: string | null;
  level_or_competition: string | null;
};

export function normalizeRbfaDivisionCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").trim();
}

function normalized(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("nl").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function divisionAge(code: string) {
  const compact = normalizeRbfaDivisionCode(code).replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^(?:IP|G|PROV|REG|U)(\d{1,2})[A-Z]*$/);
  return match ? `u${Number(match[1])}` : "";
}

function teamAge(team: RbfaSuggestionTeam) {
  const match = normalized(`${team.age_category ?? ""} ${team.name}`).match(/(?:^| )(?:u|ip u?|ip)(\d{1,2})(?: |$)/);
  return match ? `u${Number(match[1])}` : "";
}

export function suggestRbfaTeamId(division: string, teams: RbfaSuggestionTeam[]) {
  const code = normalizeRbfaDivisionCode(division).replace(/[^A-Z0-9]/g, "");
  const age = divisionAge(code);
  const isIp = code.startsWith("IP");
  const isRegional = /^G\d/.test(code) || code.startsWith("GEW");
  const isReserve = code.startsWith("RES");
  const ranked = teams.map(team => {
    const haystack = normalized(`${team.name} ${team.age_category ?? ""} ${team.level_or_competition ?? ""}`);
    const candidateAge = teamAge(team);
    let score = 0;
    if (age) score += candidateAge === age ? 100 : -100;
    if (isIp) score += /(?:^| )(?:ip|interprovinciaal)(?: |$)/.test(haystack) ? 35 : -10;
    if (isRegional) score += /(?:^| )(?:g|gew|gewestelijk|regionaal)(?: |$)/.test(haystack) ? 30 : 0;
    if (isReserve) score += /(?:^| )(?:res|reserve|reserven|belofte|beloften)(?: |$)/.test(haystack) ? 70 : -30;
    if (/^W\d/.test(code)) score += candidateAge || /belofte|reserve/.test(haystack) ? -30 : 15;
    return { team, score };
  }).filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.team.display_order - b.team.display_order || a.team.name.localeCompare(b.team.name, "nl"));
  return ranked[0]?.team.id ?? "";
}
