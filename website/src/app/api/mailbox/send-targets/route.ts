import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getMailboxSendTargets } from "@/lib/mailbox/send-targets";

export async function GET() {
  const { user, activeClubId } = await getClubContext();
  if (!user || !activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sendTargets = await getMailboxSendTargets(activeClubId, user);
  return NextResponse.json({ sendTargets });
}
