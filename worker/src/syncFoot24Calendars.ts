import { supabase } from "./supabase";
import { parseCalendar } from "./foot24CalendarParser";

function validateUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !["foot24.be", "www.foot24.be"].includes(url.hostname.toLowerCase()) || !url.pathname.endsWith(".ics")) {
    throw new Error("Invalid Foot24 URL");
  }
  return url.toString();
}

function fixture(summary: string, teamName: string) {
  const parts = summary.replace(/\s+/g, " ").trim().split(/\s+(?:-|–|—|vs?\.?|tegen)\s+/i).filter(Boolean);
  return parts.length >= 2 ? { home: parts[0], away: parts.slice(1).join(" - ") } : { home: teamName, away: summary };
}

async function syncFeed(feed: Record<string, any>) {
  const { data: team } = await supabase.from("club_teams").select("id, club_id, name").eq("id", feed.club_team_id).single();
  if (!team) throw new Error("Team not found");
  const [{ data: operationalTeam }, { data: owner }] = await Promise.all([
    supabase.from("teams").select("id").eq("club_team_id", team.id).maybeSingle(),
    supabase.from("club_memberships").select("profile_id").eq("club_id", team.club_id).eq("role", "club_admin").eq("status", "active").limit(1).maybeSingle()
  ]);
  if (!operationalTeam || !owner?.profile_id) throw new Error("Team or club admin missing");
  const headers: Record<string, string> = { Accept: "text/calendar" };
  if (feed.last_etag) headers["If-None-Match"] = feed.last_etag;
  if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;
  const response = await fetch(validateUrl(feed.feed_url), { headers, redirect: "manual", signal: AbortSignal.timeout(15000) });
  if (response.status === 304) {
    await supabase.from("club_team_calendar_feeds").update({ last_synced_at: new Date().toISOString(), last_sync_status: "ok", last_sync_message: "Geen wijzigingen." }).eq("id", feed.id);
    return;
  }
  if (!response.ok || !(response.headers.get("content-type") ?? "").toLowerCase().includes("text/calendar")) throw new Error(`Foot24 response ${response.status}`);
  const events = parseCalendar(await response.text());
  if (!events.length) throw new Error("No usable calendar events");
  let imported = 0;
  let updated = 0;
  for (const event of events) {
    const names = fixture(event.summary, team.name);
    const externalMatchId = `${team.id}:${event.uid}`;
    const payload = {
      coach_id: owner.profile_id, club_id: team.club_id, club_team_id: team.id, team_a_id: operationalTeam.id,
      team_a_name: names.home, team_b_name: names.away, match_date: event.startsAt.toISOString().slice(0, 10),
      start_time: event.startsAt.toLocaleTimeString("nl-BE", { timeZone: "Europe/Brussels", hour12: false, hour: "2-digit", minute: "2-digit" }),
      status: event.cancelled ? "finished" : "scheduled", external_source: "foot24", external_match_id: externalMatchId
    };
    const { data: existing } = await supabase.from("matches").select("id").eq("external_source", "foot24").eq("external_match_id", externalMatchId).maybeSingle();
    const { error } = existing ? await supabase.from("matches").update(payload).eq("id", existing.id) : await supabase.from("matches").insert(payload);
    if (error) throw error;
    if (existing) updated += 1; else imported += 1;
  }
  await supabase.from("club_team_calendar_feeds").update({
    last_synced_at: new Date().toISOString(), last_sync_status: "ok", last_sync_message: `${imported} nieuw, ${updated} bijgewerkt.`,
    last_etag: response.headers.get("etag"), last_modified: response.headers.get("last-modified"), updated_at: new Date().toISOString()
  }).eq("id", feed.id);
}

export async function syncFoot24Calendars() {
  const cutoff = new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString();
  const { data: feeds, error } = await supabase.from("club_team_calendar_feeds").select("*").eq("enabled", true)
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`).limit(25);
  if (error) throw error;
  for (const feed of feeds ?? []) {
    try { await syncFeed(feed); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("club_team_calendar_feeds").update({
        last_synced_at: new Date().toISOString(), last_sync_status: "error", last_sync_message: message.slice(0, 500)
      }).eq("id", feed.id);
      console.error(`[worker] Foot24 sync failed for team ${feed.club_team_id}:`, message);
    }
  }
  return { checked: feeds?.length ?? 0 };
}
