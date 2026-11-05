import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getRecordingDownloadUrl } from "@/lib/recordings360-download";

export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const admin = createAdminClient();
  const { data: job } = await admin.from("recording_copy_jobs").select("object_key,status,recording_copy_plans!inner(match_id)").eq("id", params.jobId).eq("status", "done").maybeSingle();
  if (!job) return new NextResponse(null, { status: 404 });
  const plan = job.recording_copy_plans as unknown as { match_id: string };
  const { data: match } = await admin.from("matches").select("club_id,club_team_id").eq("id", plan.match_id).single();
  if (!match?.club_id) return new NextResponse(null, { status: 404 });
  const access = await getClubAccess(match.club_id, user);
  if (!hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view") || !canAccessTeam(access, match.club_team_id)) return new NextResponse(null, { status: 403 });
  return NextResponse.redirect(await getRecordingDownloadUrl(job.object_key), { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
