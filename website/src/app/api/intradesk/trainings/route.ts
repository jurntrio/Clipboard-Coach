import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { isTrainingAgeCategory } from "@/lib/training-categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

const EDIT_ROLES = new Set(["trainer", "coach", "assistant_coach", "club_admin"]);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Je sessie is verlopen." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.title !== "string"
    || !body.title.trim() || !isTrainingAgeCategory(body.ageCategory)
    || typeof body.content !== "object" || body.content === null) {
    return NextResponse.json({ error: "Vul een naam en geldig leeftijdsjaar in." }, { status: 400 });
  }

  const admin = createAdminClient();
  const access = await getClubAccess(body.clubId, user);
  if (!hasClubPermission(access, "intradesk.manage")) {
    return NextResponse.json({ error: "Je mag voor deze club geen trainingen publiceren." }, { status: 403 });
  }

  const themes = Array.isArray(body.themes)
    ? body.themes.filter((item: unknown): item is string => typeof item === "string").slice(0, 12)
    : [];
  if (typeof body.trainingId === "string") {
    const { data: existing } = await admin.from("club_trainings").select("id, club_id, current_version")
      .eq("id", body.trainingId).eq("club_id", body.clubId).eq("status", "published").maybeSingle();
    if (!existing) return NextResponse.json({ error: "Training niet gevonden." }, { status: 404 });
    const nextVersion = existing.current_version + 1;
    const { error: versionError } = await admin.from("club_training_versions").insert({
      training_id: existing.id,
      version_number: nextVersion,
      content: body.content,
      change_note: typeof body.changeNote === "string" && body.changeNote.trim()
        ? body.changeNote.trim().slice(0, 300) : "Training aangepast",
      created_by: user.id
    });
    if (versionError) return NextResponse.json({ error: "Er werd intussen een andere versie bewaard. Open de training opnieuw." }, { status: 409 });
    const { error: updateError } = await admin.from("club_trainings").update({
      title: body.title.trim().slice(0, 160),
      age_category: body.ageCategory,
      themes,
      current_version: nextVersion,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }).eq("id", existing.id).eq("current_version", existing.current_version);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ id: existing.id, version: nextVersion });
  }

  const { data: training, error: trainingError } = await admin.from("club_trainings").insert({
    club_id: body.clubId,
    title: body.title.trim().slice(0, 160),
    age_category: body.ageCategory,
    themes,
    created_by: user.id,
    updated_by: user.id
  }).select("id").single();
  if (trainingError || !training) {
    return NextResponse.json({ error: trainingError?.message ?? "Training kon niet worden bewaard." }, { status: 400 });
  }

  const { error: versionError } = await admin.from("club_training_versions").insert({
    training_id: training.id,
    version_number: 1,
    content: body.content,
    change_note: "Eerste publicatie",
    created_by: user.id
  });
  if (versionError) {
    await admin.from("club_trainings").delete().eq("id", training.id);
    return NextResponse.json({ error: versionError.message }, { status: 400 });
  }

  return NextResponse.json({ id: training.id }, { status: 201 });
}
