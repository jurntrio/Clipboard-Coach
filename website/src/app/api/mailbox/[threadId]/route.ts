import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";

export async function DELETE(_request: Request, { params }: { params: { threadId: string } }) {
  const { user, activeClubId } = await getClubContext();
  if (!user || !activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: messages, error: messagesError } = await admin.from("mailbox_messages").select("id")
    .eq("thread_id", params.threadId).eq("club_id", activeClubId);
  if (messagesError) return NextResponse.json({ error: "Gesprek kon niet gecontroleerd worden." }, { status: 500 });

  const messageIds = (messages ?? []).map((message) => message.id);
  if (!messageIds.length) return NextResponse.json({ error: "Gesprek niet gevonden." }, { status: 404 });

  const { count, error: accessError } = await admin.from("mailbox_recipients")
    .select("id", { count: "exact", head: true }).in("message_id", messageIds).eq("profile_id", user.id);
  if (accessError) return NextResponse.json({ error: "Gesprek kon niet gecontroleerd worden." }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Geen toegang tot dit gesprek." }, { status: 403 });

  const { error } = await admin.from("mailbox_recipients").update({ deleted_at: new Date().toISOString() })
    .in("message_id", messageIds).eq("profile_id", user.id);
  if (error) return NextResponse.json({ error: "Gesprek kon niet verwijderd worden." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
