export function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-BE");
}

export function uniqueTagNames(names: string[]) {
  const seen = new Set<string>();

  return names.flatMap((name) => {
    const cleaned = name.trim().replace(/\s+/g, " ");
    const key = normalizeTagName(cleaned);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [cleaned];
  });
}
