"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject } from "@/lib/r2/upload";
import { invalidateClubLogoCache } from "@/lib/belgian-clubs/resolve-club-logo";

export async function setBelgianClubLargeLogo(stamnummer: number, key: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("belgian_clubs")
    .select("large_logo_path")
    .eq("stamnummer", stamnummer)
    .maybeSingle();

  const { error } = await admin
    .from("belgian_clubs")
    .update({ large_logo_path: key })
    .eq("stamnummer", stamnummer);
  if (error) throw new Error(error.message);

  if (existing?.large_logo_path && existing.large_logo_path !== key) {
    await deleteObject(existing.large_logo_path).catch(() => {});
  }

  invalidateClubLogoCache(stamnummer);
  revalidatePath("/dashboard/admin/belgian-clubs");
}

export async function removeBelgianClubLargeLogo(stamnummer: number) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("belgian_clubs")
    .select("large_logo_path")
    .eq("stamnummer", stamnummer)
    .maybeSingle();

  const { error } = await admin
    .from("belgian_clubs")
    .update({ large_logo_path: null })
    .eq("stamnummer", stamnummer);
  if (error) throw new Error(error.message);

  if (existing?.large_logo_path) await deleteObject(existing.large_logo_path).catch(() => {});

  invalidateClubLogoCache(stamnummer);
  revalidatePath("/dashboard/admin/belgian-clubs");
}
