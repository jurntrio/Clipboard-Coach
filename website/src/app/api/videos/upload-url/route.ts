import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUploadUrl, getPublicUrl } from "@/lib/r2/upload";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key, contentType } = await request.json();

  if (typeof key !== "string" || typeof contentType !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const uploadUrl = await getUploadUrl(key, contentType);
  const publicUrl = getPublicUrl(key);
  return NextResponse.json({ uploadUrl, publicUrl });
}
