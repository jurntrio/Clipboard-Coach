import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getPartUploadUrl,
  getPublicUrl
} from "@/lib/r2/upload";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Your session has expired" }, { status: 401 });
  }

  const body = await request.json();

  if (
    typeof body.key !== "string" ||
    !(body.key.startsWith(`videos/${user.id}/`) || body.key.startsWith(`clips/${user.id}/`))
  ) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  switch (body.action) {
    case "create": {
      const { key, contentType } = body;
      if (typeof key !== "string" || typeof contentType !== "string") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const uploadId = await createMultipartUpload(key, contentType);
      return NextResponse.json({ uploadId });
    }

    case "part-urls": {
      const { key, uploadId, partNumbers } = body;
      if (typeof key !== "string" || typeof uploadId !== "string" || !Array.isArray(partNumbers)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const urls = await Promise.all(
        partNumbers.map(async (partNumber: number) => ({
          partNumber,
          url: await getPartUploadUrl(key, uploadId, partNumber)
        }))
      );
      return NextResponse.json({ urls });
    }

    case "complete": {
      const { key, uploadId, parts } = body;
      if (typeof key !== "string" || typeof uploadId !== "string" || !Array.isArray(parts)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      await completeMultipartUpload(key, uploadId, parts);
      return NextResponse.json({ publicUrl: getPublicUrl(key) });
    }

    case "abort": {
      const { key, uploadId } = body;
      if (typeof key !== "string" || typeof uploadId !== "string") {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      await abortMultipartUpload(key, uploadId);
      return NextResponse.json({ aborted: true });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
