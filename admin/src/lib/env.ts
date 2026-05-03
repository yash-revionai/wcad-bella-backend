const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL,
  adminApiKey: process.env.ADMIN_API_KEY,
  adminDevBypass: process.env.ADMIN_DEV_BYPASS,
};

export function getMissingAdminEnv() {
  const entries: Array<[string, string | undefined]> = [
    ["NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", env.supabaseAnonKey],
    ["SUPABASE_SERVICE_KEY", env.supabaseServiceKey],
    ["NEXT_PUBLIC_BACKEND_URL or BACKEND_URL", env.backendUrl],
    ["ADMIN_API_KEY", env.adminApiKey],
  ];

  return entries
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export function hasSupabaseAuthEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function hasSupabaseServiceEnv() {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}

export function hasBackendEnv() {
  return Boolean(env.backendUrl && env.adminApiKey);
}

export function isDemoMode() {
  return false;
}

export function hasAdminDevBypass() {
  return process.env.NODE_ENV !== "production" && env.adminDevBypass === "true";
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

export function getBackendAdminHeaders() {
  if (!env.adminApiKey) {
    return null;
  }

  return {
    "x-admin-api-key": env.adminApiKey,
  };
}
