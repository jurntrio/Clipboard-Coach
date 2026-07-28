import { NextResponse } from "next/server";
import { ACTIVE_CLUB_COOKIE, getClubContext } from "@/lib/auth/active-club";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    clubs: context.clubs,
    activeClubId: context.activeClubId,
    isPlatformAdmin: context.isPlatformAdmin
  });
}

export async function POST(request: Request) {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { clubId?: string } | null;
  if (!body?.clubId || !context.clubs.some((club) => club.id === body.clubId)) {
    return NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 });
  }
  const response = NextResponse.json({ activeClubId: body.clubId });
  response.cookies.set(ACTIVE_CLUB_COOKIE, body.clubId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}

