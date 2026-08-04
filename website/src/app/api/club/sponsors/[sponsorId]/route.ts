import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: { sponsorId: string } }) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(access, "sponsors.manage")) return NextResponse.json({ error: "Geen recht om sponsors te beheren." }, { status: 403 });
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.companyName === "string" && body.companyName.trim()) updates.company_name = body.companyName.trim();
  if (typeof body.active === "boolean") updates.active = body.active;
  for (const [input, column] of [["logoUrl", "logo_url"], ["alternateLogoUrl", "alternate_logo_url"], ["websiteUrl", "website_url"]] as const) {
    if (body[input] === null || typeof body[input] === "string") updates[column] = validUrl(body[input]);
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Geen geldige wijzigingen." }, { status: 400 });
  const { error } = await createAdminClient().from("sponsors").update(updates)
    .eq("id", params.sponsorId).eq("club_id", context.activeClubId);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze sponsor bestaat al binnen de club." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { sponsorId: string } }) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const access = await getClubAccess(context.activeClubId, context.user);
  if (!hasClubPermission(access, "sponsors.manage")) return NextResponse.json({ error: "Geen recht om sponsors te verwijderen." }, { status: 403 });
  const admin = createAdminClient();
  const { data: sponsor } = await admin.from("sponsors").select("id, sponsor_assignments(id)").eq("id", params.sponsorId).eq("club_id", context.activeClubId).maybeSingle();
  if (!sponsor) return NextResponse.json({ error: "Sponsor niet gevonden." }, { status: 404 });
  if ((sponsor.sponsor_assignments ?? []).length) {
    const { error } = await admin.from("sponsors").update({ active: false }).eq("id", sponsor.id);
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ archived: true });
  }
  const { error } = await admin.from("sponsors").delete().eq("id", sponsor.id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ deleted: true });
}

function validUrl(value: unknown) {
  if (value === null || value === "") return null;
  try { const url = new URL(String(value)); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}
