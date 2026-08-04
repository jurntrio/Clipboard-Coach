import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clubId = context.activeClubId;
  if (!clubId) return NextResponse.json({ unreadMailboxCount: 0, pendingApprovalCount: 0, canApproveRequests: false });

  const admin = createAdminClient();
  const access = await getClubAccess(clubId, context.user);
  const canApproveRequests = ["club_admin", "platform_admin"].includes(access.role) || hasClubPermission(access, "teams.manage_all");

  const [{ count: unreadMailboxCount }, approvalCounts] = await Promise.all([
    admin.from("mailbox_recipients").select("id, mailbox_messages!inner(club_id)", { count: "exact", head: true })
      .eq("profile_id", context.user.id).is("read_at", null).eq("mailbox_messages.club_id", clubId),
    canApproveRequests ? Promise.all([
      admin.from("club_memberships").select("profile_id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
      admin.from("club_teams").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
      admin.from("person_claim_reviews").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending")
    ]) : Promise.resolve([])
  ]);
  const pendingApprovalCount = approvalCounts.reduce((total, result) => total + (result.count ?? 0), 0);

  return NextResponse.json({ unreadMailboxCount: unreadMailboxCount ?? 0, pendingApprovalCount, canApproveRequests });
}
