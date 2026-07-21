import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUploadUrl, getPublicUrl } from "@/lib/r2/upload";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Your session has expired" }, { status: 401 });
    }

    const { key, contentType } = await request.json();

    if (
      typeof key !== "string" ||
      !(key.startsWith(`videos/${user.id}/`) || key.startsWith(`clips/${user.id}/`)) ||
      typeof contentType !== "string" ||
      !contentType
    ) {
      return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
    }

    const uploadUrl = await getUploadUrl(key, contentType);
    const publicUrl = getPublicUrl(key);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error("Failed to create R2 upload URL:", error);
    return NextResponse.json(
      { error: "Storage is not configured correctly. Check the server's R2 environment variables." },
      { status: 500 }
    );
  }
}
