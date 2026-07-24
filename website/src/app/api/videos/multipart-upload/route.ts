import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getPartUploadUrl,
  getPublicUrl
} from "@/lib/r2/upload";
import { validCompletedParts, validPartNumbers } from "@/lib/security/multipart";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Your session has expired" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.key !== "string" || !(body.key.startsWith(`videos/${user.id}/`) || body.key.startsWith(`clips/${user.id}/`))) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  switch (body.action) {
    case "create": {
      if (typeof body.contentType !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      const uploadId = await createMultipartUpload(body.key, body.contentType);
      return NextResponse.json({ uploadId });
    }

    case "part-urls": {
      if (typeof body.uploadId !== "string" || !validPartNumbers(body.partNumbers)) {
        return NextResponse.json({ error: "Request between 1 and 100 unique, valid part numbers." }, { status: 400 });
      }
      const { data: allowed, error: quotaError } = await supabase.rpc("consume_upload_part_url_quota", { requested_count: body.partNumbers.length });
      if (quotaError) {
        console.error("Could not enforce multipart URL quota:", quotaError);
        return NextResponse.json({ error: "Upload protection is temporarily unavailable." }, { status: 503 });
      }
      if (!allowed) return NextResponse.json({ error: "Too many upload parts requested. Try again in a minute." }, { status: 429 });

      const urls = await Promise.all(body.partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await getPartUploadUrl(body.key as string, body.uploadId as string, partNumber)
      })));
      return NextResponse.json({ urls });
    }

    case "complete": {
      if (typeof body.uploadId !== "string" || !validCompletedParts(body.parts)) {
        return NextResponse.json({ error: "Invalid completed upload parts" }, { status: 400 });
      }
      await completeMultipartUpload(body.key, body.uploadId, body.parts);
      return NextResponse.json({ publicUrl: getPublicUrl(body.key) });
    }

    case "abort": {
      if (typeof body.uploadId !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      await abortMultipartUpload(body.key, body.uploadId);
      return NextResponse.json({ aborted: true });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
