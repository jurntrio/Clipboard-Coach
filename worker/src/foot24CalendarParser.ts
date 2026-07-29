export type FeedEvent = { uid: string; startsAt: Date; summary: string; cancelled: boolean };

function unescape(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseDate(value: string) {
  if (/^\d{8}$/.test(value)) return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T12:00:00+02:00`);
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${match[7] ? "Z" : "+02:00"}`);
}

export function parseCalendar(source: string) {
  const events: FeedEvent[] = [];
  let current: Record<string, string> | null = null;
  for (const line of source.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") {
      const startsAt = parseDate(current?.DTSTART ?? "");
      if (current?.UID && current.SUMMARY && startsAt && !Number.isNaN(startsAt.getTime())) {
        events.push({ uid: unescape(current.UID), summary: unescape(current.SUMMARY), startsAt, cancelled: current.STATUS?.toUpperCase() === "CANCELLED" });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).split(";")[0].toUpperCase();
    if (["UID", "DTSTART", "SUMMARY", "STATUS"].includes(key)) current[key] = line.slice(separator + 1);
  }
  return events;
}
