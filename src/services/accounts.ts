import { AppError } from "../lib/errors.js";
import { createServiceSupabaseClient } from "../lib/supabase.js";

export type Account = {
  id: string;
  business_name: string;
  email: string;
  google_refresh_token_encrypted: string | null;
  google_access_token_encrypted: string | null;
  google_token_expiry: string | null;
  google_main_calendar_id: string | null;
};

const accountSelect =
  "id,business_name,email,google_refresh_token_encrypted,google_access_token_encrypted,google_token_expiry,google_main_calendar_id";

export async function getAccount(accountId: string): Promise<Account> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.from("accounts").select(accountSelect).eq("id", accountId).single();

  if (error || !data) {
    throw new AppError("Account not found", 404);
  }

  return data as Account;
}

export async function getDefaultAccount(): Promise<Account> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.from("accounts").select(accountSelect).order("created_at").limit(1).single();

  if (error || !data) {
    throw new AppError("No account has been seeded yet", 404);
  }

  return data as Account;
}

export async function resolveAccount(accountId?: string): Promise<Account> {
  return accountId ? getAccount(accountId) : getDefaultAccount();
}

