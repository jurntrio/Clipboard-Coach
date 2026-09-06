import { NextResponse } from "next/server";

// Retired: old browser tabs must not keep changing obsolete share/team defaults.
export function GET() {
  return NextResponse.json({ error: "Introbeelden kies je nu bij ‘Clip maken’. Vernieuw de pagina." }, { status: 410 });
}
export const POST = GET;
