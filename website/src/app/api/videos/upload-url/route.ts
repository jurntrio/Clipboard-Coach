import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { getUploadUrl, getPublicUrl } from "@/lib/r2/upload";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Your session has expired" }, { status: 401 });
    }

    const { key, contentType } = await request.json();

    const clubLogoMatch = typeof key === "string" ? key.match(/^clubs\/([0-9a-f-]{36})\/logo-[a-zA-Z0-9.-]+$/) : null;
    const clubSponsorMatch = typeof key === "string" ? key.match(/^clubs\/([0-9a-f-]{36})\/sponsors\/[a-zA-Z0-9.-]+$/) : null;
    let clubLogoAllowed = false;
    const brandingClubId = clubLogoMatch?.[1] ?? clubSponsorMatch?.[1];
    if (brandingClubId && ["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
      const admin = createAdminClient();
      const { data: membership } = await admin.from("club_memberships").select("role, status")
        .eq("club_id", brandingClubId).eq("profile_id", user.id).maybeSingle();
      clubLogoAllowed = isAdminEmail(user.email) || (membership?.role === "club_admin" && membership.status === "active");
    }

    // Large logos in the Belgian club reference list are managed exclusively
    // by the platform admin (not individual club admins), so this is a
    // stricter check than the club-branding one above.
    const belgianClubLogoMatch = typeof key === "string" ? key.match(/^belgian-clubs\/large\/\d+\.[a-zA-Z0-9]+$/) : null;
    let belgianClubLogoAllowed = false;
    if (belgianClubLogoMatch && ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(contentType)) {
      if (isAdminEmail(user.email)) {
        belgianClubLogoAllowed = true;
      } else {
        const admin = createAdminClient();
        const { data: profile } = await admin.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
        belgianClubLogoAllowed = profile?.account_role === "platform_admin";
      }
    }

    if (
      typeof key !== "string" ||
      !(key.startsWith(`videos/${user.id}/`) || key.startsWith(`clips/${user.id}/`) || key.startsWith(`drawings/${user.id}/`) || clubLogoAllowed || belgianClubLogoAllowed) ||
      typeof contentType !== "string" ||
      !contentType
    ) {
      return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    }

    const uploadUrl = await getUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error("Failed to create R2 upload URL:", error);
    return NextResponse.json(
      { error: "Storage is not configured correctly. Check the server's R2 environment variables." },
      { status: 500 }
    );
  }
}
