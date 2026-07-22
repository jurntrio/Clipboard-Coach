import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-BE");
}

function normalizedNameParts(value: string) {
  return normalizeName(value).split(" ").filter(Boolean).sort((a, b) => a.localeCompare(b)).join(" ");
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: ownedTeams }, { data: ownMemberships }] = await Promise.all([
    admin.from("teams").select("id, coach_id").eq("coach_id", user.id),
    admin.from("team_staff_members").select("team_id").eq("user_id", user.id)
  ]);
  const teamIds = Array.from(new Set([...(ownedTeams ?? []).map((team) => team.id), ...(ownMemberships ?? []).map((membership) => membership.team_id)]));
  if (!teamIds.length) return NextResponse.json({ members: [] });

  const { data: memberships } = await admin.from("team_staff_members").select("id, team_id, user_id, created_at").in("team_id", teamIds);
  const userIds = Array.from(new Set((memberships ?? []).map((membership) => membership.user_id)));
  const { data: profiles } = userIds.length ? await admin.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || "Registered staff"]));
  return NextResponse.json({ members: (memberships ?? []).map((membership) => ({ ...membership, full_name: names.get(membership.user_id) || "Registered staff", removable: ownedTeams?.some((team) => team.id === membership.team_id && team.coach_id !== membership.user_id) ?? false })) });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { teamId?: string; fullName?: string } | null;
  const fullName = body?.fullName?.trim() ?? "";
  if (!body?.teamId || fullName.length < 3) return NextResponse.json({ error: "Enter the complete registered name." }, { status: 400 });

  const admin = createAdminClient();
  const { data: team } = await admin.from("teams").select("id, coach_id").eq("id", body.teamId).maybeSingle();
  if (!team || team.coach_id !== user.id) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data: profiles } = await admin.from("profiles").select("id, full_name, email");
  const requestedName = normalizedNameParts(fullName);
  const requestedEmail = fullName.toLocaleLowerCase("en-US");
  const matches = (profiles ?? []).filter((profile) => normalizedNameParts(profile.full_name || "") === requestedName || profile.email.toLocaleLowerCase("en-US") === requestedEmail);
  if (matches.length !== 1) return NextResponse.json({ error: "No unique registered user matched that complete name. Check the spelling with the person." }, { status: 404 });

  const { error } = await admin.from("team_staff_members").insert({ team_id: team.id, user_id: matches[0].id, added_by: user.id });
  if (error?.code === "23505") return NextResponse.json({ error: "This user is already linked to the team." }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linked: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { membershipId?: string } | null;
  if (!body?.membershipId) return NextResponse.json({ error: "Membership is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: membership } = await admin.from("team_staff_members").select("id, user_id, teams(coach_id)").eq("id", body.membershipId).maybeSingle();
  const team = membership?.teams as unknown as { coach_id: string } | null;
  if (!membership || team?.coach_id !== user.id) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  if (membership.user_id === team.coach_id) return NextResponse.json({ error: "The team owner cannot be removed from staff." }, { status: 400 });
  const { error } = await admin.from("team_staff_members").delete().eq("id", membership.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
