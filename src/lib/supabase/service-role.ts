import { createClient } from "@supabase/supabase-js";

/**
 * Service role client - bypasses RLS. Use only for admin operations (e.g. admin delete).
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Required for admin delete operations."
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
