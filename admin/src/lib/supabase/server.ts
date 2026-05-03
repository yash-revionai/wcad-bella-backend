import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSupabaseAuthEnv, requireSupabaseServiceEnv } from "../env";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseAuthEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot mutate cookies, but reads still work.
        }
      },
    },
  });
}

export function createServiceSupabaseClient() {
  const { url, serviceKey } = requireSupabaseServiceEnv();
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
