import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Meld je eerst aan." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.token !== "string") {
    return NextResponse.json({ error: "Uitnodiging ontbreekt." }, { status: 400 });
  }
  const { data, error } = await createAdminClient().rpc("consume_person_account_invitation", {
    raw_token: body.token,
    target_profile_id: user.id
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ personAccountId: data });
}
