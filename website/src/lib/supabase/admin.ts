import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-only use (bypasses Row Level Security).
// Only use this for reads that have already been authorized some other way
// (e.g. a valid share_links token), never for anything reachable from the
// browser bundle.
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false }
  });
}
