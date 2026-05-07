import "server-only";

import { redirect } from "next/navigation";
import { hasAdminDevBypass, hasSupabaseServiceEnv } from "./env";
import { createServiceSupabaseClient } from "./supabase/server";
import { getSession, type Session } from "./session";

export async function getDevBypassAdmin() {
  if (!hasAdminDevBypass() || !hasSupabaseServiceEnv()) {
    return null;
  }

  const serviceSupabase = createServiceSupabaseClient();
  const { data: adminUser } = await serviceSupabase
    .from("admin_users")
    .select("email,role,account_id")
    .order("created_at")
    .limit(1)
    .single();

  return adminUser
    ? {
        email: String(adminUser.email),
        role: String(adminUser.role),
        accountId: String(adminUser.account_id),
      }
    : null;
}

export async function getAdminSession(): Promise<Session | null> {
  const devAdmin = await getDevBypassAdmin();
  if (devAdmin) {
    return {
      email: devAdmin.email,
      accountId: devAdmin.accountId,
      isSuperAdmin: false,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    };
  }

  return getSession();
}

export async function getAuthorizedAdminAccountId() {
  const session = await getAdminSession();

  if (!session?.accountId) {
    redirect("/");
  }

  return session.accountId;
}

export async function requireLiveAdminAccountId(redirectPath: string) {
  const accountId = await getAuthorizedAdminAccountId();
  if (!accountId) {
    redirect(`${redirectPath}?saved=config-error`);
  }

  return accountId;
}

export async function assertOwnedLocation(locationId: string, accountId: string, redirectPath: string) {
  const supabase = createServiceSupabaseClient();
  const { data: location } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("account_id", accountId)
    .single();

  if (!location) {
    redirect(`${redirectPath}?saved=invalid`);
  }
}
