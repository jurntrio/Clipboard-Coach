export function officialTeamId(raw: string) {
  try {
    const url = new URL(raw);
    return ["voetbalvlaanderen.be", "www.voetbalvlaanderen.be"].includes(url.hostname.toLowerCase())
      ? url.pathname.match(/^\/club\/\d+\/ploeg\/(\d+)\/(?:kalender|overzicht)\/?$/)?.[1] ?? null
      : null;
  } catch { return null; }
}

export function normalizedTeamName(value: string) {
  return value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
