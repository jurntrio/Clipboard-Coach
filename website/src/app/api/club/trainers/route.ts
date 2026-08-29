import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null) as { clubId?: string; trainerId?: string } | null;
  if (!body?.clubId || !body.trainerId) {
    return NextResponse.json({ error: "Club en persoon zijn verplicht." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: trainer }, access] = await Promise.all([
    admin.from("club_trainers").select("id, club_id, profile_id, display_name")
      .eq("id", body.trainerId).eq("club_id", body.clubId).maybeSingle()
    , getClubAccess(body.clubId, user)
  ]);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  }
  if (!trainer) return NextResponse.json({ error: "Persoon niet gevonden." }, { status: 404 });
  if (trainer.profile_id === user.id) {
    return NextResponse.json({ error: "Je kunt jezelf niet via deze lijst uit de club verwijderen." }, { status: 400 });
  }

  if (!trainer.profile_id) {
    const { error } = await admin.from("club_trainers").delete().eq("id", trainer.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removedName: trainer.display_name });
  }

  const { data: removedName, error } = await admin.rpc("remove_registered_club_identity", {
    target_club_id: body.clubId,
    target_profile_id: trainer.profile_id,
    actor_profile_id: user.id
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removedName: removedName || trainer.display_name });
}
