import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

export function createServiceSupabaseClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

