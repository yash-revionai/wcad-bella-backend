import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseAuthEnv } from "../env";

export function createClientSupabaseClient() {
  const { url, anonKey } = requireSupabaseAuthEnv();
  return createBrowserClient(url, anonKey);
}
