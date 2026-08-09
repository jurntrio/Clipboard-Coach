import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });

  if (!context.activeClubId) return NextResponse.json({ canManageTags: false });

  const access = await getClubAccess(context.activeClubId, context.user);
  return NextResponse.json({ canManageTags: hasClubPermission(access, "games.tag") });
}
