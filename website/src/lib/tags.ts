export function isPeriodMarker(name: string) {
  const normalized = name.trim().toLowerCase();
  return normalized === "start" || normalized === "end";
}
