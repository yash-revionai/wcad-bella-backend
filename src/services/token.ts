import { google } from "googleapis";
import { AppError } from "../lib/errors.js";
import { env } from "../lib/env.js";

const calendarScopes = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events"
];

let _auth: InstanceType<typeof google.auth.GoogleAuth> | null = null;

export function getServiceAccountAuth(): InstanceType<typeof google.auth.GoogleAuth> {
  if (_auth) return _auth;

  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new AppError(
      "Google Calendar is not configured. Add GOOGLE_SERVICE_ACCOUNT_JSON to environment variables.",
      503,
      "google_calendar_not_configured"
    );
  }

  let credentials: object;
  try {
    credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new AppError(
      "GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON.",
      503,
      "google_calendar_not_configured"
    );
  }

  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: calendarScopes
  });

  return _auth;
}

export function isServiceAccountConfigured(): boolean {
  return Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON);
}
