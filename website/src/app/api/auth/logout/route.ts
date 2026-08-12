import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: "Afmelden mislukt." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
