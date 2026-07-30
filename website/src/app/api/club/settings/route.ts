import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string") {
    return NextResponse.json({ error: "Ongeldige instellingen." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("club_memberships")
    .select("role, status")
    .eq("club_id", body.clubId)
    .eq("profile_id", user.id)
    .maybeSingle();
  const allowed = isAdminEmail(user.email) || (membership?.role === "club_admin" && membership.status === "active");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (body.featurePermission && ["teams_manage", "teams_import"].includes(body.featurePermission.key)
    && typeof body.featurePermission.enabled === "boolean") {
    const rows = [{
      club_id: body.clubId,
      module_key: body.featurePermission.key,
      enabled: body.featurePermission.enabled,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }];
    if (body.featurePermission.key === "teams_manage" && !body.featurePermission.enabled) {
      rows.push({ ...rows[0], module_key: "teams_import", enabled: false });
    }
    const { error } = await admin.from("club_module_entitlements").upsert(rows, { onConflict: "club_id,module_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ permissions: rows });
  }

  if (typeof body.useGeneralSponsor === "boolean") {
    const { data: entitlement } = await admin.from("clubs").select("clip_advertising_enabled").eq("id", body.clubId).maybeSingle();
    if (!entitlement?.clip_advertising_enabled) return NextResponse.json({ error: "De sponsormodule is niet actief voor deze club." }, { status: 403 });
    const { data: club, error } = await admin.from("clubs")
      .update({ use_general_sponsor: body.useGeneralSponsor })
      .eq("id", body.clubId)
      .select("id, use_general_sponsor, general_sponsor_url")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (body.useGeneralSponsor && club.general_sponsor_url) {
      await admin.from("matches").update({ sponsor_source: "club" })
        .eq("club_id", body.clubId).eq("sponsor_source", "none");
    } else if (!body.useGeneralSponsor) {
      await admin.from("matches").update({ sponsor_source: "none" })
        .eq("club_id", body.clubId).eq("sponsor_source", "club");
    }
    return NextResponse.json({ club });
  }

  if (body.generalSponsorUrl === null || (typeof body.generalSponsorUrl === "string"
    && body.generalSponsorUrl.startsWith(`${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/clubs/${body.clubId}/sponsors/`))) {
    const { data: club, error } = await admin.from("clubs")
      .update({ general_sponsor_url: body.generalSponsorUrl })
      .eq("id", body.clubId)
      .select("id, general_sponsor_url, use_general_sponsor")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (body.generalSponsorUrl && club.use_general_sponsor) {
      await admin.from("matches").update({ sponsor_source: "club" })
        .eq("club_id", body.clubId).eq("sponsor_source", "none");
    } else if (!body.generalSponsorUrl) {
      await admin.from("matches").update({ sponsor_source: "none" })
        .eq("club_id", body.clubId).eq("sponsor_source", "club");
    }
    return NextResponse.json({ club });
  }

  if (body.teamSponsor && typeof body.teamSponsor.teamId === "string") {
    const updates: { sponsor_url?: string | null; sponsor_enabled?: boolean } = {};
    if (typeof body.teamSponsor.enabled === "boolean") updates.sponsor_enabled = body.teamSponsor.enabled;
    if (body.teamSponsor.sponsorUrl === null || (typeof body.teamSponsor.sponsorUrl === "string"
      && body.teamSponsor.sponsorUrl.startsWith(`${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/clubs/${body.clubId}/sponsors/`))) {
      updates.sponsor_url = body.teamSponsor.sponsorUrl;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "Ongeldige sponsorinstelling." }, { status: 400 });
    const { data: team, error } = await admin.from("club_teams")
      .update(updates)
      .eq("id", body.teamSponsor.teamId)
      .eq("club_id", body.clubId)
      .select("id, sponsor_url, sponsor_enabled")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ team });
  }

  if (Array.isArray(body.clipViewCountRoles)) {
    const allowedRoles = new Set(["club_admin", "club_admin_viewer", "analyst", "trainer"]);
    const roles = Array.from(new Set([
      "club_admin",
      ...body.clipViewCountRoles.filter((role: unknown): role is string => typeof role === "string" && allowedRoles.has(role))
    ]));
    const { data: club, error } = await admin.from("clubs")
      .update({ clip_view_count_roles: roles })
      .eq("id", body.clubId)
      .select("id, clip_view_count_roles")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ club });
  }

  if (body.logoUrl === null || (typeof body.logoUrl === "string" && (
    body.logoUrl.startsWith("/branding/clubs/") ||
    body.logoUrl.startsWith(`${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/clubs/${body.clubId}/`)
  ))) {
    const { data: club, error } = await admin.from("clubs")
      .update({ logo_url: body.logoUrl || null })
      .eq("id", body.clubId)
      .select("id, logo_url")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ club });
  }

  const settings = body.trainingSettings;
  const validTrainingPolicy = ["automatic", "approval_required", "personal_only"].includes(settings?.newTrainingPolicy);
  const validVersionPolicy = ["automatic", "approval_required"].includes(settings?.newVersionPolicy);
  if (!validTrainingPolicy || !validVersionPolicy
    || typeof settings.trainersCanCreateVersions !== "boolean"
    || typeof settings.trainersCanDownload !== "boolean"
    || typeof settings.ageCategoryRequired !== "boolean"
    || typeof settings.changeNoteRequired !== "boolean") {
    return NextResponse.json({ error: "Ongeldige Training/Intradesk-instellingen." }, { status: 400 });
  }
  const { data: saved, error } = await admin.from("club_training_settings").upsert({
    club_id: body.clubId,
    new_training_policy: settings.newTrainingPolicy,
    new_version_policy: settings.newVersionPolicy,
    trainers_can_create_versions: settings.trainersCanCreateVersions,
    trainers_can_download: settings.trainersCanDownload,
    age_category_required: settings.ageCategoryRequired,
    change_note_required: settings.changeNoteRequired,
    updated_by: user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: "club_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ trainingSettings: saved });
}
