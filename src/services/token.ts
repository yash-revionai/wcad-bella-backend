import { createHmac, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import { AppError } from "../lib/errors.js";
import { decryptSecret, encryptSecret } from "../lib/encryption.js";
import { requireEnv, requireGoogleEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { clearGoogleTokens, getAccount, updateGoogleTokens } from "./accounts.js";
import { sendDeveloperAlert } from "./notifications.js";

const calendarScopes = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];

export function createOAuthClient() {
  const { clientId, clientSecret, redirectUri } = requireGoogleEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function signGoogleAuthState(accountId: string) {
  return createHmac("sha256", requireEnv("ADMIN_API_KEY")).update(accountId).digest("base64url");
}

export function verifyGoogleAuthState(state: string) {
  const [accountId, signature] = state.split(".");
  if (!accountId || !signature) {
    throw new AppError("Invalid Google OAuth state", 400);
  }

  const expectedSignature = signGoogleAuthState(accountId);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AppError("Invalid Google OAuth state", 400);
  }

  return accountId;
}

export function buildGoogleAuthUrl(accountId: string) {
  const oauth2Client = createOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: calendarScopes,
    state: `${accountId}.${signGoogleAuthState(accountId)}`
  });
}

export async function exchangeGoogleCode(accountId: string, code: string) {
  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new AppError("Google did not return an access token", 502);
  }

  const expiryDate = new Date(tokens.expiry_date ?? Date.now() + 60 * 60 * 1000);

  const tokenUpdate: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string;
    expiryDate: Date;
  } = {
    accessTokenEncrypted: encryptSecret(tokens.access_token),
    expiryDate
  };

  if (tokens.refresh_token) {
    tokenUpdate.refreshTokenEncrypted = encryptSecret(tokens.refresh_token);
  }

  await updateGoogleTokens(accountId, tokenUpdate);
}

export async function getValidAccessToken(accountId: string) {
  const account = await getAccount(accountId);

  if (account.google_access_token_encrypted && account.google_token_expiry) {
    const expiry = new Date(account.google_token_expiry).getTime();
    if (expiry > Date.now() + 60_000) {
      return decryptSecret(account.google_access_token_encrypted);
    }
  }

  if (!account.google_refresh_token_encrypted) {
    throw new AppError("Google Calendar is not connected for this account", 409);
  }

  try {
    const oauth2Client = createOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: decryptSecret(account.google_refresh_token_encrypted)
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new AppError("Google did not return a refreshed access token", 502);
    }

    const expiryDate = new Date(credentials.expiry_date ?? Date.now() + 60 * 60 * 1000);

    await updateGoogleTokens(accountId, {
      accessTokenEncrypted: encryptSecret(credentials.access_token),
      expiryDate
    });

    return credentials.access_token;
  } catch (error) {
    await clearGoogleTokens(accountId);
    try {
      await sendDeveloperAlert({
        subject: "Bella Google Calendar reconnect required",
        text: [
          "Google Calendar access failed and tokens were cleared.",
          `Account: ${account.business_name} (${account.email})`,
          `Account ID: ${account.id}`,
          "Action needed: reconnect Google Calendar in Bella admin."
        ].join("\n")
      });
    } catch (alertError) {
      // Do not mask the reconnect-required error Bella/admin needs to see.
      logger.error({ error: alertError, accountId }, "Developer Google reconnect alert failed");
    }
    throw new AppError(
      "Google Calendar access has expired or been revoked. Reconnect Google Calendar in admin and try again.",
      409,
      "google_calendar_reconnect_required"
    );
  }
}

export function calendarScopesForDisplay() {
  return [...calendarScopes];
}
