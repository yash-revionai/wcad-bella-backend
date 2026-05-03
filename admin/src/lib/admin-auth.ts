import "server-only";

import { redirect } from "next/navigation";
import { hasAdminDevBypass, hasSupabaseAuthEnv, hasSupabaseServiceEnv } from "./env";
import { createServiceSupabaseClient, createServerSupabaseClient } from "./supabase/server";

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

export async function getAuthorizedAdminAccountId() {
  const devAdmin = await getDevBypassAdmin();
  if (devAdmin) {
    return devAdmin.accountId;
  }

  if (!hasSupabaseAuthEnv() || !hasSupabaseServiceEnv()) {
    redirect("/?setup=missing-env");
  }

  const authSupabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user?.email) {
    redirect("/");
  }

  const serviceSupabase = createServiceSupabaseClient();
  const { data: adminUser } = await serviceSupabase
    .from("admin_users")
    .select("account_id")
    .eq("email", user.email)
    .single();

  if (!adminUser?.account_id) {
    redirect("/dashboard?saved=unauthorized");
  }

  return String(adminUser.account_id);
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
