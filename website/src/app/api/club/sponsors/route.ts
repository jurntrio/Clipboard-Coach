import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

async function sponsorContext(permission: "sponsors.view" | "sponsors.manage") {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(access, permission)) return null;
  return { clubId: context.activeClubId, user: context.user, access };
}

export async function GET() {
  const context = await sponsorContext("sponsors.view");
  if (!context) return NextResponse.json({ error: "Geen toegang tot sponsors." }, { status: 403 });
  const includePrivate = hasClubPermission(context.access, "sponsors.internal.view");
  const admin = createAdminClient();
  const query = includePrivate
    ? "id, company_name, logo_url, alternate_logo_url, website_url, active, created_at, updated_at, sponsor_private_details(contact_name, contact_email, contact_phone, internal_note), sponsor_assignments(id, season_id, starts_on, ends_on, sponsor_level, status, operational_note, sponsor_assignment_scopes(scope_id))"
    : "id, company_name, logo_url, alternate_logo_url, website_url, active, created_at, updated_at, sponsor_assignments(id, season_id, starts_on, ends_on, sponsor_level, status, sponsor_assignment_scopes(scope_id))";
  const { data, error } = await admin.from("sponsors").select(query).eq("club_id", context.clubId).order("company_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sponsors: data ?? [], permissions: Array.from(context.access.permissions), clubId: context.clubId });
}

export async function POST(request: Request) {
  const context = await sponsorContext("sponsors.manage");
  if (!context) return NextResponse.json({ error: "Geen recht om sponsors te beheren." }, { status: 403 });
  const body = await request.json();
  if (body.action === "createAssignment") {
    if (!hasClubPermission(context.access, "sponsors.assignments.manage")) return NextResponse.json({ error: "Geen recht om sponsortoewijzingen te beheren." }, { status: 403 });
    const admin = createAdminClient();
    const sponsorId = String(body.sponsorId || ""); const seasonId = body.seasonId ? String(body.seasonId) : null;
    const [{ data: sponsor }, { data: season }] = await Promise.all([
      admin.from("sponsors").select("id").eq("id", sponsorId).eq("club_id", context.clubId).maybeSingle(),
      seasonId ? admin.from("club_seasons").select("id, status").eq("id", seasonId).eq("club_id", context.clubId).maybeSingle() : Promise.resolve({ data: null })
    ]);
    if (!sponsor || (seasonId && !season)) return NextResponse.json({ error: "Sponsor of seizoen is ongeldig." }, { status: 400 });
    if (season?.status === "ARCHIVED") return NextResponse.json({ error: "Een gearchiveerd seizoen is alleen-lezen." }, { status: 409 });
    const levels = new Set(["main_sponsor", "partner", "sponsor", "other"]);
    const { data, error } = await admin.from("sponsor_assignments").insert({ sponsor_id: sponsorId, club_id: context.clubId, season_id: seasonId,
      sponsor_level: levels.has(body.sponsorLevel) ? body.sponsorLevel : "sponsor", status: "active", created_by: context.user.id }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignmentId: data.id }, { status: 201 });
  }
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (!companyName) return NextResponse.json({ error: "Bedrijfsnaam is verplicht." }, { status: 400 });
  const admin = createAdminClient();
  const { data: sponsor, error } = await admin.from("sponsors").insert({
    club_id: context.clubId,
    company_name: companyName,
    logo_url: cleanUrl(body.logoUrl), alternate_logo_url: cleanUrl(body.alternateLogoUrl),
    website_url: cleanUrl(body.websiteUrl), active: body.active !== false, created_by: context.user.id
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze sponsor bestaat al binnen de club." : error.message }, { status: 400 });

  if (hasClubPermission(context.access, "sponsors.internal.manage") && hasPrivateDetails(body)) {
    const { error: privateError } = await admin.from("sponsor_private_details").insert({
      sponsor_id: sponsor.id, contact_name: cleanText(body.contactName), contact_email: cleanText(body.contactEmail),
      contact_phone: cleanText(body.contactPhone), internal_note: cleanText(body.internalNote), updated_by: context.user.id
    });
    if (privateError) return NextResponse.json({ error: privateError.message, sponsorId: sponsor.id }, { status: 400 });
  }
  if (body.seasonId && Array.isArray(body.scopeIds) && hasClubPermission(context.access, "sponsors.assignments.manage")) {
    const { data: assignment, error: assignmentError } = await admin.from("sponsor_assignments").insert({ sponsor_id: sponsor.id, club_id: context.clubId, season_id: body.seasonId, sponsor_level: ["main_sponsor","partner","sponsor","other"].includes(body.sponsorLevel) ? body.sponsorLevel : "sponsor", status: "active", created_by: context.user.id }).select("id").single();
    if (assignmentError) return NextResponse.json({ error: assignmentError.message, sponsorId: sponsor.id }, { status: 400 });
    if (body.scopeIds.length) await admin.from("sponsor_assignment_scopes").insert(body.scopeIds.map((scopeId:string)=>({ assignment_id: assignment.id, scope_id: scopeId })));
  }
  return NextResponse.json({ sponsorId: sponsor.id }, { status: 201 });
}

function cleanText(value: unknown) { return typeof value === "string" ? value.trim() || null : null; }
function cleanUrl(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  try { const url = new URL(text); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}
function hasPrivateDetails(body: Record<string, unknown>) {
  return [body.contactName, body.contactEmail, body.contactPhone, body.internalNote].some(value => cleanText(value));
}
