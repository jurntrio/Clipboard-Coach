import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { isTrainingAgeCategory, supportsBelgianTeamTactics } from "@/lib/training-categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TRAINER_ROLES = new Set(["trainer", "coach", "assistant_coach", "club_admin"]);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Je sessie is verlopen." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.title !== "string" || !body.title.trim()
    || !isTrainingAgeCategory(body.ageCategory) || typeof body.content !== "object" || body.content === null) {
    return NextResponse.json({ error: "Vul een naam en leeftijdsjaar in." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin.from("club_memberships").select("role, status")
    .eq("club_id", body.clubId).eq("profile_id", user.id).maybeSingle();
  if (!isAdminEmail(user.email) && (membership?.status !== "active" || !TRAINER_ROLES.has(membership.role))) {
    return NextResponse.json({ error: "Je mag voor deze club geen trainingen bewaren." }, { status: 403 });
  }
  const { data: club } = await admin.from("clubs").select("country").eq("id", body.clubId).maybeSingle();
  if (!club) return NextResponse.json({ error: "Club niet gevonden." }, { status: 404 });
  const content = {
    ...(body.content as Record<string, unknown>),
    teamTactics: supportsBelgianTeamTactics(club.country) && Array.isArray(body.content.teamTactics)
      ? body.content.teamTactics.filter((item: unknown): item is string => typeof item === "string")
      : []
  };

  const themes = Array.isArray(body.themes)
    ? body.themes.filter((item: unknown): item is string => typeof item === "string").slice(0, 12)
    : [];
  const base = {
    club_id: body.clubId,
    owner_id: user.id,
    title: body.title.trim().slice(0, 160),
    age_category: body.ageCategory,
    themes,
    content,
    updated_at: new Date().toISOString()
  };

  let personal;
  if (typeof body.personalTrainingId === "string") {
    const result = await admin.from("trainer_trainings").update(base)
      .eq("id", body.personalTrainingId).eq("owner_id", user.id).select("*").maybeSingle();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    personal = result.data;
  }
  if (!personal) {
    const result = await admin.from("trainer_trainings").insert(base).select("*").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    personal = result.data;
  }

  const { data: settings } = await admin.from("club_training_settings")
    .select("new_training_policy, new_version_policy").eq("club_id", body.clubId).maybeSingle();
  const policy = settings?.new_training_policy ?? "automatic";
  const existingClubTrainingId: string | null = personal.club_training_id
    ?? (typeof body.clubTrainingId === "string" ? body.clubTrainingId : null);
  let publicationState: "personal" | "pending_approval" | "published" =
    existingClubTrainingId && settings?.new_version_policy === "approval_required"
      ? "pending_approval"
      : policy === "automatic" ? "published"
        : policy === "approval_required" ? "pending_approval" : "personal";
  let clubTrainingId = existingClubTrainingId;

  if (publicationState === "published") {
    const linked = clubTrainingId
      ? await admin.from("club_trainings").select("id, current_version").eq("id", clubTrainingId)
        .eq("club_id", body.clubId).maybeSingle()
      : { data: null };
    if (linked.data) {
      const nextVersion = linked.data.current_version + 1;
      const { error: versionError } = await admin.from("club_training_versions").insert({
        training_id: linked.data.id,
        version_number: nextVersion,
        content,
        change_note: "Automatisch gepubliceerd vanuit de persoonlijke training",
        created_by: user.id
      });
      if (versionError) return NextResponse.json({ error: versionError.message }, { status: 409 });
      const { error: updateError } = await admin.from("club_trainings").update({
        title: base.title, age_category: base.age_category, themes,
        current_version: nextVersion, updated_by: user.id, updated_at: base.updated_at
      }).eq("id", linked.data.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
      clubTrainingId = linked.data.id;
    } else {
      const { data: clubTraining, error: clubError } = await admin.from("club_trainings").insert({
        club_id: body.clubId, title: base.title, age_category: base.age_category, themes,
        created_by: user.id, updated_by: user.id
      }).select("id").single();
      if (clubError || !clubTraining) return NextResponse.json({ error: clubError?.message ?? "Publiceren is mislukt." }, { status: 400 });
      const { error: versionError } = await admin.from("club_training_versions").insert({
        training_id: clubTraining.id, version_number: 1, content,
        change_note: "Automatisch gepubliceerd vanuit de persoonlijke training", created_by: user.id
      });
      if (versionError) return NextResponse.json({ error: versionError.message }, { status: 400 });
      clubTrainingId = clubTraining.id;
    }
  }

  const { error: stateError } = await admin.from("trainer_trainings").update({
    club_training_id: clubTrainingId,
    publication_state: publicationState
  }).eq("id", personal.id).eq("owner_id", user.id);
  if (stateError) return NextResponse.json({ error: stateError.message }, { status: 400 });

  return NextResponse.json({
    personalTrainingId: personal.id,
    clubTrainingId,
    publicationState
  });
}
