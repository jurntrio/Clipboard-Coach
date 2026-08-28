const BRUSSELS_TIME_ZONE = "Europe/Brussels";
const DEFAULT_EVENT_DURATION_MINUTES = 120;

export function hasScheduledEventEnded(date: string | null, time: string | null, now = new Date()) {
  if (!date) return false;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time?.slice(0, 5) || "00:00").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return false;

  const eventEndsAt = Date.UTC(year, month - 1, day, hour, minute + DEFAULT_EVENT_DURATION_MINUTES);
  return eventEndsAt <= brusselsWallClockTimestamp(now);
}

function brusselsWallClockTimestamp(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRUSSELS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
}
