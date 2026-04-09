import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Solo servidor: nunca expongas esta clave al cliente. */
export function isCloudPersistenceEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function createServiceSupabase(): SupabaseClient | null {
  if (!isCloudPersistenceEnabled()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
