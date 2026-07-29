import { createAdminClient } from "@/lib/supabase/admin";

type CalendarEvent = {
  uid: string;
  startsAt: Date;
  summary: string;
  location: string | null;
  cancelled: boolean;
};

function unfoldCalendar(source: string) {
  return source.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeIcal(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseDate(value: string) {
  const normalized = value.trim();
  if (/^\d{8}$/.test(normalized)) {
    return new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T12:00:00+02:00`);
  }
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? "00"}${match[7] ? "Z" : "+02:00"}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateFoot24Url(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Dit is geen geldige URL."); }
  if (url.protocol !== "https:" || !["foot24.be", "www.foot24.be"].includes(url.hostname.toLowerCase()) || !url.pathname.endsWith(".ics")) {
    throw new Error("Gebruik een geldige HTTPS iCal-link van foot24.be.");
  }
  return url.toString();
}

export function parseFoot24Calendar(source: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let current: Record<string, string> | null = null;
  for (const line of unfoldCalendar(source)) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") {
      if (current) {
        const startsAt = parseDate(current.DTSTART ?? "");
        if (current.UID && startsAt && current.SUMMARY) {
          events.push({
            uid: unescapeIcal(current.UID),
            startsAt,
            summary: unescapeIcal(current.SUMMARY),
            location: current.LOCATION ? unescapeIcal(current.LOCATION) : null,
            cancelled: current.STATUS?.toUpperCase() === "CANCELLED"
          });
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).split(";")[0].toUpperCase();
    if (["UID", "DTSTART", "SUMMARY", "LOCATION", "STATUS"].includes(key)) current[key] = line.slice(separator + 1);
  }
  return events;
}

function splitFixture(summary: string, ownTeamName: string) {
  const cleaned = summary.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+(?:-|–|—|vs?\.?|tegen)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { home: parts[0], away: parts.slice(1).join(" - ") };
  return { home: ownTeamName, away: cleaned };
}

function mappedFixture(summary: string, teamName: string, clubName: string) {
  const source = splitFixture(summary, teamName);
  const normalize = (value: string) => value.toLocaleLowerCase("nl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const clubKey = normalize(clubName);
  const homeIsClub = normalize(source.home).includes(clubKey);
  const awayIsClub = normalize(source.away).includes(clubKey);
  if (awayIsClub && !homeIsClub) return { own: teamName, opponent: source.home, isHome: false };
  return { own: teamName, opponent: source.away || source.home, isHome: true };
}

export async function syncFoot24Feed(teamId: string) {
  const admin = createAdminClient();
  const [teamResult, feedResult] = await Promise.all([
    admin.from("club_teams").select("id, club_id, name").eq("id", teamId).maybeSingle(),
    admin.from("club_team_calendar_feeds").select("*").eq("club_team_id", teamId).maybeSingle()
  ]);
  if (teamResult.error) throw new Error(`Ploeg kon niet worden gelezen: ${teamResult.error.message}`);
  if (feedResult.error) throw new Error(`Kalenderinstelling kon niet worden gelezen: ${feedResult.error.message}`);
  const team = teamResult.data;
  const feed = feedResult.data;
  if (!team) throw new Error("Ploeg niet gevonden.");
  if (!feed) throw new Error("Geen kalenderlink voor deze ploeg ingesteld.");

  const url = validateFoot24Url(feed.feed_url);
  const headers: Record<string, string> = { Accept: "text/calendar" };
  if (feed.last_etag) headers["If-None-Match"] = feed.last_etag;
  if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;
  const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
  if (response.status === 304) {
    await admin.from("club_team_calendar_feeds").update({
      last_synced_at: new Date().toISOString(), last_sync_status: "ok", last_sync_message: "Geen wijzigingen."
    }).eq("id", feed.id);
    return { imported: 0, updated: 0, unchanged: true };
  }
  if (!response.ok) throw new Error(`Foot24 antwoordde met status ${response.status}.`);
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("text/calendar")) {
    throw new Error("De link gaf geen iCal-kalender terug.");
  }
  const events = parseFoot24Calendar(await response.text());
  if (!events.length) throw new Error("De kalender bevat geen bruikbare wedstrijden.");
  const [{ data: club }, { data: operationalTeam }] = await Promise.all([
    admin.from("clubs").select("name").eq("id", team.club_id).maybeSingle(),
    admin.from("teams").select("id").eq("club_team_id", team.id).maybeSingle()
  ]);
  if (!operationalTeam) throw new Error("De ploeg heeft geen gekoppelde spelerslijst.");
  const { data: owner } = await admin.from("club_memberships").select("profile_id").eq("club_id", team.club_id)
    .eq("role", "club_admin").eq("status", "active").limit(1).maybeSingle();
  if (!owner?.profile_id) throw new Error("De club heeft geen actieve clubadmin om de wedstrijden aan te koppelen.");

  let imported = 0;
  let updated = 0;
  for (const event of events) {
    const fixture = mappedFixture(event.summary, team.name, club?.name ?? team.name);
    const externalMatchId = `${team.id}:${event.uid}`;
    const payload = {
      coach_id: owner.profile_id,
      club_id: team.club_id,
      club_team_id: team.id,
      team_a_id: operationalTeam.id,
      team_a_name: fixture.own,
      team_b_name: fixture.opponent,
      is_home_match: fixture.isHome,
      match_date: event.startsAt.toISOString().slice(0, 10),
      start_time: event.startsAt.toLocaleTimeString("nl-BE", { timeZone: "Europe/Brussels", hour12: false, hour: "2-digit", minute: "2-digit" }),
      status: event.cancelled ? "finished" : "scheduled",
      external_source: "foot24",
      external_match_id: externalMatchId
    };
    const { data: existing } = await admin.from("matches").select("id").eq("external_source", "foot24").eq("external_match_id", externalMatchId).maybeSingle();
    const result = existing
      ? await admin.from("matches").update(payload).eq("id", existing.id)
      : await admin.from("matches").insert(payload);
    if (result.error) throw new Error(result.error.message);
    if (existing) updated += 1; else imported += 1;
  }
  await admin.from("club_team_calendar_feeds").update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: "ok",
    last_sync_message: `${imported} nieuw, ${updated} bijgewerkt.`,
    last_etag: response.headers.get("etag"),
    last_modified: response.headers.get("last-modified"),
    updated_at: new Date().toISOString()
  }).eq("id", feed.id);
  return { imported, updated, unchanged: false };
}
