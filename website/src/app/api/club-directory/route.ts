import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clubId = url.searchParams.get("clubId");
  const supabase = createClient();

  if (clubId) {
    const { data, error } = await supabase.rpc("list_public_club_teams", { target_club_id: clubId });
    if (error) return NextResponse.json({ error: "Teams konden niet geladen worden." }, { status: 500 });
    return NextResponse.json({ teams: data ?? [] });
  }

  const search = url.searchParams.get("search")?.trim().slice(0, 100) ?? "";
  const { data, error } = await supabase.rpc("search_club_directory", { search_term: search });
  if (error) return NextResponse.json({ error: "Clubs konden niet geladen worden." }, { status: 500 });
  return NextResponse.json({ clubs: data ?? [] });
}
