import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-side client — apps/api only. Uses the service role key, which
 * bypasses row-level security, so this must never be imported into
 * anything that ships to the browser.
 */
export function createServerClient(): SupabaseClient<Database> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Browser-side client — apps/web. Uses the anon key; every read is subject
 * to the RLS policies in schema.sql.
 */
export function createBrowserClient(url: string, anonKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
