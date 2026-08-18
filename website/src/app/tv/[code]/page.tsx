import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TvSharePage({ params }: { params: { code: string } }) {
  const code = params.code.trim().toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, "");
  if (code.length !== 8) notFound();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("share_links")
    .select("token, expires_at")
    .eq("short_code", code)
    .maybeSingle();

  if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) notFound();
  redirect(`/share/${data.token}`);
}
