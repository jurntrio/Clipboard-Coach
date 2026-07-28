"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_MODULE_BUNDLES, CLUB_MODULES, type ClubModuleBundleKey, type ClubModuleKey } from "@/lib/club-modules";

// A ~100 year ban is the conventional way to permanently block a Supabase
// auth user; there is no dedicated "disabled" flag on auth.users.
const BAN_DURATION = "876000h";

export async function banCoach(coachId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(coachId, { ban_duration: BAN_DURATION });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/coaches/${coachId}`);
}

export async function unbanCoach(coachId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(coachId, { ban_duration: "none" });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/coaches/${coachId}`);
}

// Manual plan override, ahead of a real Stripe integration. Once checkout +
// webhooks exist, `plan` should be driven by subscription_status instead.
export async function setCoachPlan(coachId: string, plan: "free" | "pro") {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ plan }).eq("id", coachId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/coaches/${coachId}`);
}

export async function setAccountRole(coachId: string, accountRole: "coach" | "club_admin" | "club_admin_viewer" | "analyst") {
  const platformAdmin = await requireAdmin();
  if (coachId === platformAdmin.id) throw new Error("The platform admin role cannot be changed.");
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ account_role: accountRole }).eq("id", coachId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/coaches/${coachId}`);
}

export async function setAdminViewer(coachId: string, isAdminViewer: boolean) {
  const platformAdmin = await requireAdmin();
  if (coachId === platformAdmin.id) throw new Error("The platform admin role cannot be changed.");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("account_role").eq("id", coachId).maybeSingle();
  if (!profile) throw new Error("Coach not found.");
  const nextRole = isAdminViewer ? "admin_viewer" : profile.account_role === "admin_viewer" ? "coach" : profile.account_role;
  const { error } = await admin.from("profiles").update({ account_role: nextRole }).eq("id", coachId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
  revalidatePath(`/dashboard/admin/coaches/${coachId}`);
}

export async function createClub(name: string, rbfaRegistrationNumber: string, clubAdminId: string) {
  await requireAdmin();
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Geef een clubnaam in.");
  const admin = createAdminClient();
  const { data: club, error } = await admin.from("clubs").insert({
    name: cleanName,
    rbfa_registration_number: rbfaRegistrationNumber.trim() || null
  }).select("id").single();
  if (error) throw new Error(error.message);
  if (clubAdminId) await setClubMembership(club.id, clubAdminId, "club_admin");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/clubs");
}

export async function setClubMembership(clubId: string, profileId: string, role: "club_admin" | "club_admin_viewer" | "analyst") {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: club }, { data: profile }] = await Promise.all([
    admin.from("clubs").select("id").eq("id", clubId).maybeSingle(),
    admin.from("profiles").select("id").eq("id", profileId).maybeSingle()
  ]);
  if (!club || !profile) throw new Error("Club of gebruiker niet gevonden.");
  const { error } = await admin.from("club_memberships").upsert(
    { club_id: clubId, profile_id: profileId, role },
    { onConflict: "club_id,profile_id" }
  );
  if (error) throw new Error(error.message);
  const { data: roles } = await admin.from("club_memberships").select("role").eq("profile_id", profileId);
  const accountRole = roles?.some((item) => item.role === "club_admin")
    ? "club_admin"
    : roles?.some((item) => item.role === "club_admin_viewer")
    ? "club_admin_viewer"
    : roles?.some((item) => item.role === "analyst") ? "analyst" : "coach";
  await admin.from("profiles").update({ account_role: accountRole }).eq("id", profileId);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/coaches/${profileId}`);
}

export async function removeClubMembership(clubId: string, profileId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("club_memberships").delete().eq("club_id", clubId).eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  const { data: remaining } = await admin.from("club_memberships").select("role").eq("profile_id", profileId);
  const nextRole = remaining?.some((item) => item.role === "club_admin")
    ? "club_admin"
    : remaining?.some((item) => item.role === "club_admin_viewer")
    ? "club_admin_viewer"
    : remaining?.some((item) => item.role === "analyst") ? "analyst" : "coach";
  await admin.from("profiles").update({ account_role: nextRole }).eq("id", profileId);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/coaches/${profileId}`);
}

export async function setClubModuleEntitlement(clubId: string, moduleKey: ClubModuleKey, enabled: boolean) {
  const platformAdmin = await requireAdmin();
  if (!CLUB_MODULES.some((module) => module.key === moduleKey)) throw new Error("Onbekende clubmodule.");
  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id").eq("id", clubId).maybeSingle();
  if (!club) throw new Error("Club niet gevonden.");
  const { error } = await admin.from("club_module_entitlements").upsert({
    club_id: clubId,
    module_key: moduleKey,
    enabled,
    updated_by: platformAdmin.id,
    updated_at: new Date().toISOString()
  }, { onConflict: "club_id,module_key" });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath("/dashboard/club");
}

export async function setClubModuleBundle(clubId: string, bundleKey: ClubModuleBundleKey, enabled: boolean) {
  const platformAdmin = await requireAdmin();
  const bundle = CLUB_MODULE_BUNDLES.find((item) => item.key === bundleKey);
  if (!bundle) throw new Error("Onbekende clubmodule.");
  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id").eq("id", clubId).maybeSingle();
  if (!club) throw new Error("Club niet gevonden.");
  const timestamp = new Date().toISOString();
  const { error } = await admin.from("club_module_entitlements").upsert(
    bundle.modules.map((moduleKey) => ({
      club_id: clubId,
      module_key: moduleKey,
      enabled,
      updated_by: platformAdmin.id,
      updated_at: timestamp
    })),
    { onConflict: "club_id,module_key" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath("/dashboard/club");
}

export async function updateTrainerAssignment(input: {
  profileId: string;
  fullName: string;
  phoneNumber: string;
  clubId: string;
  role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst";
  teamIds: string[];
}) {
  const platformAdmin = await requireAdmin();
  if (input.profileId === platformAdmin.id) throw new Error("Je eigen platformadminrechten kunnen hier niet gewijzigd worden.");
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("Geef de naam van de trainer in.");
  if (!input.clubId) throw new Error("Kies een club.");
  const admin = createAdminClient();
  const [{ data: club }, { data: profile }, { data: validTeams }] = await Promise.all([
    admin.from("clubs").select("id").eq("id", input.clubId).maybeSingle(),
    admin.from("profiles").select("id").eq("id", input.profileId).maybeSingle(),
    input.teamIds.length
      ? admin.from("club_teams").select("id").eq("club_id", input.clubId).in("id", input.teamIds)
      : Promise.resolve({ data: [] as { id: string }[] })
  ]);
  if (!club || !profile) throw new Error("Club of trainer niet gevonden.");
  if ((validTeams ?? []).length !== new Set(input.teamIds).size) throw new Error("Een gekozen ploeg behoort niet tot deze club.");

  const { error: profileError } = await admin.from("profiles").update({
    full_name: fullName,
    account_role: input.role === "trainer" ? "coach" : input.role
  }).eq("id", input.profileId);
  if (profileError) throw new Error(profileError.message);

  await admin.from("club_memberships").delete().eq("profile_id", input.profileId).neq("club_id", input.clubId);
  const { error: membershipError } = await admin.from("club_memberships").upsert(
    { club_id: input.clubId, profile_id: input.profileId, role: input.role },
    { onConflict: "club_id,profile_id" }
  );
  if (membershipError) throw new Error(membershipError.message);

  const { data: otherTrainerRows } = await admin.from("club_trainers").select("id").eq("profile_id", input.profileId).neq("club_id", input.clubId);
  if (otherTrainerRows?.length) await admin.from("club_trainers").delete().in("id", otherTrainerRows.map((item) => item.id));

  let { data: trainer } = await admin.from("club_trainers").select("id").eq("club_id", input.clubId).eq("profile_id", input.profileId).maybeSingle();
  if (!trainer) {
    const { data: placeholder } = await admin.from("club_trainers").select("id").eq("club_id", input.clubId).is("profile_id", null).ilike("display_name", fullName).maybeSingle();
    if (placeholder) {
      const { data: linked, error } = await admin.from("club_trainers").update({ profile_id: input.profileId, display_name: fullName, phone_number: input.phoneNumber.trim() || null, invitation_status: "linked" }).eq("id", placeholder.id).select("id").single();
      if (error) throw new Error(error.message);
      trainer = linked;
    } else {
      const { data: created, error } = await admin.from("club_trainers").insert({ club_id: input.clubId, profile_id: input.profileId, display_name: fullName, phone_number: input.phoneNumber.trim() || null, invitation_status: "linked" }).select("id").single();
      if (error) throw new Error(error.message);
      trainer = created;
    }
  } else {
    await admin.from("club_trainers").update({ display_name: fullName, phone_number: input.phoneNumber.trim() || null, invitation_status: "linked" }).eq("id", trainer.id);
  }

  await admin.from("club_trainer_teams").delete().eq("trainer_id", trainer.id);
  if (input.teamIds.length) {
    const { error } = await admin.from("club_trainer_teams").insert(input.teamIds.map((clubTeamId) => ({ trainer_id: trainer!.id, club_team_id: clubTeamId })));
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/coaches/${input.profileId}`);
  revalidatePath("/dashboard/club");
}

// Deletes the auth user, which cascades (via FK on delete cascade) through
// profiles and all account-owned records. This includes club_memberships,
// club_trainers and, through the trainer row, every club team assignment.
// Note: this does not remove the coach's video files from R2 storage.
export async function deleteCoach(coachId: string) {
  const platformAdmin = await requireAdmin();
  if (coachId === platformAdmin.id) throw new Error("Je eigen platformadminaccount kan hier niet verwijderd worden.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(coachId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath("/dashboard/club");
}
