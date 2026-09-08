import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host === "sportvisualsystems.com" || host === "clipboardcoachstudio.com" || host === "www.clipboardcoachstudio.com") {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = "app.sportvisualsystems.com";
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/legal-consent",
    "/auth/:path*",
    "/join/:path*",
    "/club-invite/:path*",
    "/person-invite/:path*",
    "/share/:path*",
    "/tag/:path*",
    "/club-tv/:path*",
    "/clubboys/:path*",
    "/privacy",
    "/terms",
    "/children-and-images"
  ]
};
