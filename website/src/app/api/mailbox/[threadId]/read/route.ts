import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";

export async function PATCH(_request: Request, { params }: { params: { threadId: string } }) {
  const { user, activeClubId } = await getClubContext();
  if (!user || !activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: messages } = await admin.from("mailbox_messages").select("id")
    .eq("thread_id", params.threadId).eq("club_id", activeClubId);
  const messageIds = (messages ?? []).map((message) => message.id);
  if (!messageIds.length) return NextResponse.json({ error: "Gesprek niet gevonden." }, { status: 404 });
  const { count: recipientCount, error: recipientError } = await admin.from("mailbox_recipients")
    .select("id", { count: "exact", head: true }).in("message_id", messageIds).eq("profile_id", user.id);
  if (recipientError) return NextResponse.json({ error: "Gesprek kon niet gecontroleerd worden." }, { status: 500 });
  if (!recipientCount) return NextResponse.json({ error: "Geen toegang tot dit gesprek." }, { status: 403 });

  const { error } = await admin.from("mailbox_recipients").update({ read_at: new Date().toISOString() })
    .in("message_id", messageIds).eq("profile_id", user.id).is("read_at", null);
  if (error) return NextResponse.json({ error: "Leesstatus kon niet worden opgeslagen." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
