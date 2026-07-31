import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

async function currentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const clubContext = await getClubContext();
  const user = clubContext.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (clubContext.activeClubId) {
    const access = clubContext.clubs.find((club) => club.id === clubContext.activeClubId);
    if (!access) return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
    const authorization = await getClubAccess(clubContext.activeClubId, user);
    if (!hasClubPermission(authorization, "teams.view")) return NextResponse.json({ error: "Geen toegang tot Teams." }, { status: 403 });

    const { data: clubTeams } = await admin.from("club_teams")
      .select("id").eq("club_id", clubContext.activeClubId).eq("status", "active");
    let allowedClubTeamIds = (clubTeams ?? []).map((team) => team.id);
    if (authorization.teamIds !== null) {
      allowedClubTeamIds = allowedClubTeamIds.filter((teamId) => canAccessTeam(authorization, teamId));
    }
    const { data: operationalTeams } = allowedClubTeamIds.length
      ? await admin.from("teams").select("id, club_team_id").in("club_team_id", allowedClubTeamIds)
      : { data: [] };
    const operationalTeamByClubTeam = new Map((operationalTeams ?? []).map((team) => [team.club_team_id, team.id]));
    const { data: assignments } = allowedClubTeamIds.length
      ? await admin.from("club_trainer_teams")
        .select("id, club_team_id, trainer_id, club_trainers(profile_id, display_name)")
        .in("club_team_id", allowedClubTeamIds).eq("status", "active")
      : { data: [] };

    return NextResponse.json({
      members: (assignments ?? []).flatMap((assignment) => {
        const teamId = operationalTeamByClubTeam.get(assignment.club_team_id);
        const trainer = assignment.club_trainers as unknown as { profile_id: string | null; display_name: string | null } | null;
        if (!teamId || !trainer) return [];
        return [{
          id: assignment.id,
          team_id: teamId,
          user_id: trainer.profile_id ?? assignment.trainer_id,
          full_name: trainer.display_name?.trim() || "Trainer",
          removable: false
        }];
      }),
      invitations: []
    });
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
