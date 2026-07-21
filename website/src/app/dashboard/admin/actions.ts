"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

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

// Deletes the auth user, which cascades (via FK on delete cascade) through
// profiles -> teams/videos/clips/standard_tags and everything under them.
// Note: this does not remove the coach's video files from R2 storage.
export async function deleteCoach(coachId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(coachId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
}
