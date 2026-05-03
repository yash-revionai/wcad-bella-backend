const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL,
};

export function hasSupabaseAuthEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function hasSupabaseServiceEnv() {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}

export function hasBackendEnv() {
  return Boolean(env.backendUrl);
}

export function isDemoMode() {
  return !hasSupabaseAuthEnv() || !hasSupabaseServiceEnv();
}

export function requireSupabaseAuthEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Missing Supabase auth environment variables for the admin app.");
  }

  return {
    url: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
  };
}

export function requireSupabaseServiceEnv() {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error("Missing Supabase service environment variables for the admin app.");
  }

  return {
    url: env.supabaseUrl,
    serviceKey: env.supabaseServiceKey,
  };
}

export function getBackendUrl() {
  return env.backendUrl ?? null;
}
