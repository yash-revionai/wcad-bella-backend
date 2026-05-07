const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  sessionSecret: process.env.SESSION_SECRET,
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL,
  adminApiKey: process.env.ADMIN_API_KEY,
  adminDevBypass: process.env.ADMIN_DEV_BYPASS,
};

export type BackendEnvIssue = "missing-backend-url" | "missing-admin-api-key" | "localhost-backend-url";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function isLocalhostUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getBackendEnvIssue(): BackendEnvIssue | null {
  if (!env.backendUrl) {
    return "missing-backend-url";
  }

  if (isProductionRuntime() && isLocalhostUrl(env.backendUrl)) {
    return "localhost-backend-url";
  }

  if (!env.adminApiKey) {
    return "missing-admin-api-key";
  }

  return null;
}

export function getMissingAdminEnv() {
  const entries: Array<[string, string | undefined]> = [
    ["NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl],
    ["SUPABASE_SERVICE_KEY", env.supabaseServiceKey],
    ["SESSION_SECRET", env.sessionSecret],
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
  return getBackendEnvIssue() === null;
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
