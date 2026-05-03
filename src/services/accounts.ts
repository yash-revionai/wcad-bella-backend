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

export async function updateGoogleTokens(
  accountId: string,
  tokens: {
    refreshTokenEncrypted?: string;
    accessTokenEncrypted: string;
    expiryDate: Date;
  }
) {
  const supabase = createServiceSupabaseClient();
  const update: Record<string, string | null> = {
    google_access_token_encrypted: tokens.accessTokenEncrypted,
    google_token_expiry: tokens.expiryDate.toISOString()
  };

  if (tokens.refreshTokenEncrypted) {
    update.google_refresh_token_encrypted = tokens.refreshTokenEncrypted;
  }

  const { error } = await supabase.from("accounts").update(update).eq("id", accountId);

  if (error) {
    throw new AppError(`Unable to save Google tokens: ${error.message}`, 500);
  }
}

export async function clearGoogleTokens(accountId: string) {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      google_refresh_token_encrypted: null,
      google_access_token_encrypted: null,
      google_token_expiry: null,
      google_main_calendar_id: null
    })
    .eq("id", accountId);

  if (error) {
    throw new AppError(`Unable to clear Google tokens: ${error.message}`, 500);
  }
}

export async function clearCalendarMappings(accountId: string) {
  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("locations")
    .update({ google_calendar_id: null })
    .eq("account_id", accountId);

  if (error) {
    throw new AppError(`Unable to clear calendar mappings: ${error.message}`, 500);
  }
}
