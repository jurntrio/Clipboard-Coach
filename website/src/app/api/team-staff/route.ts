import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function currentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const invitationsOnly = new URL(request.url).searchParams.get("invitationsOnly") === "true";
  if (invitationsOnly) {
    const { data: invitations } = await admin.from("team_staff_invitations")
      .select("id, team_id, created_at, teams(name)").eq("invited_user_id", user.id);
    return NextResponse.json({ members: [], invitations: (invitations ?? []).map((invitation) => ({
      id: invitation.id,
      team_id: invitation.team_id,
      team_name: (invitation.teams as unknown as { name: string } | null)?.name || "Team",
      created_at: invitation.created_at
    })) });
  }
  const [{ data: ownedTeams }, { data: ownMemberships }, { data: invitations }] = await Promise.all([
    admin.from("teams").select("id, coach_id").eq("coach_id", user.id),
    admin.from("team_staff_members").select("team_id").eq("user_id", user.id),
    admin.from("team_staff_invitations").select("id, team_id, created_at").eq("invited_user_id", user.id)
  ]);
  const teamIds = Array.from(new Set([...(ownedTeams ?? []).map((team) => team.id), ...(ownMemberships ?? []).map((membership) => membership.team_id)]));
  const { data: memberships } = teamIds.length
    ? await admin.from("team_staff_members").select("id, team_id, user_id, created_at").in("team_id", teamIds)
    : { data: [] };
  const userIds = Array.from(new Set((memberships ?? []).map((membership) => membership.user_id)));
  const { data: profiles } = userIds.length ? await admin.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || "Registered staff"]));

  const invitationTeamIds = Array.from(new Set((invitations ?? []).map((invitation) => invitation.team_id)));
  const { data: invitationTeams } = invitationTeamIds.length ? await admin.from("teams").select("id, name").in("id", invitationTeamIds) : { data: [] };
  const teamNames = new Map((invitationTeams ?? []).map((team) => [team.id, team.name]));

  return NextResponse.json({
    members: (memberships ?? []).map((membership) => ({
      ...membership,
      full_name: names.get(membership.user_id) || "Registered staff",
      removable: ownedTeams?.some((team) => team.id === membership.team_id && team.coach_id !== membership.user_id) ?? false
    })),
    invitations: (invitations ?? []).map((invitation) => ({ ...invitation, team_name: teamNames.get(invitation.team_id) || "Team" }))
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { teamId?: string; email?: string } | null;
  const email = body?.email?.trim().toLocaleLowerCase("en-US") ?? "";
  if (!body?.teamId || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter the exact registered email address." }, { status: 400 });

  const admin = createAdminClient();
  const { data: team } = await admin.from("teams").select("id, coach_id").eq("id", body.teamId).maybeSingle();
  if (!team || team.coach_id !== user.id) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (profile && profile.id !== user.id) {
    const { data: existingMember } = await admin.from("team_staff_members").select("id").eq("team_id", team.id).eq("user_id", profile.id).maybeSingle();
    if (!existingMember) {
      const { error } = await admin.from("team_staff_invitations").upsert(
        { team_id: team.id, invited_user_id: profile.id, invited_by: user.id },
        { onConflict: "team_id,invited_user_id", ignoreDuplicates: true }
      );
      if (error) return NextResponse.json({ error: "The invitation could not be saved." }, { status: 500 });
    }
  }

  // Deliberately identical for existing and unknown addresses to prevent account discovery.
  return NextResponse.json({ invited: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { invitationId?: string; action?: "accept" | "decline" } | null;
  if (!body?.invitationId || !["accept", "decline"].includes(body.action ?? "")) return NextResponse.json({ error: "Invalid invitation action" }, { status: 400 });

  const admin = createAdminClient();
  const { data: invitation } = await admin.from("team_staff_invitations").select("id, invited_user_id").eq("id", body.invitationId).maybeSingle();
  if (!invitation || invitation.invited_user_id !== user.id) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });

  if (body.action === "accept") {
    const { data: accepted, error } = await createClient().rpc("accept_team_staff_invitation", { invitation_id: invitation.id });
    if (error || !accepted) return NextResponse.json({ error: "The invitation could not be accepted." }, { status: 409 });
  } else {
    const { error } = await admin.from("team_staff_invitations").delete().eq("id", invitation.id).eq("invited_user_id", user.id);
    if (error) return NextResponse.json({ error: "The invitation could not be declined." }, { status: 500 });
  }
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { membershipId?: string } | null;
  if (!body?.membershipId) return NextResponse.json({ error: "Membership is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data: membership } = await admin.from("team_staff_members").select("id, user_id, teams(coach_id)").eq("id", body.membershipId).maybeSingle();
  const team = membership?.teams as unknown as { coach_id: string } | null;
  if (!membership || team?.coach_id !== user.id) return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  if (membership.user_id === team.coach_id) return NextResponse.json({ error: "The team owner cannot be removed from staff." }, { status: 400 });
  const { error } = await admin.from("team_staff_members").delete().eq("id", membership.id);
  if (error) return NextResponse.json({ error: "The staff member could not be removed." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
