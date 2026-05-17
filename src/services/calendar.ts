import { google, calendar_v3 } from "googleapis";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { monitoring } from "../lib/monitoring.js";
import { getServiceAccountAuth } from "./token.js";

function createCalendarClient() {
  return google.calendar({ version: "v3", auth: getServiceAccountAuth() });
}

const eventCacheTtlMs = 30_000;
const eventCache = new Map<string, { expiresAt: number; events: calendar_v3.Schema$Event[] }>();

type GoogleCalendarOperation =
  | "list_calendars"
  | "read_events"
  | "read_freebusy"
  | "create_event"
  | "delete_event";

function extractGoogleStatus(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "number") {
    return error.code;
  }

  if ("response" in error && typeof error.response === "object" && error.response !== null) {
    const response = error.response as { status?: unknown };
    return typeof response.status === "number" ? response.status : undefined;
  }

  return undefined;
}

function extractGoogleMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}

function isReconnectRequiredError(error: unknown) {
  const status = extractGoogleStatus(error);
  const message = extractGoogleMessage(error).toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    message.includes("invalid_grant") ||
    message.includes("invalid credentials") ||
    message.includes("insufficient authentication scopes") ||
    message.includes("access token") ||
    message.includes("oauth")
  );
}

function toCalendarAppError(error: unknown, operation: GoogleCalendarOperation) {
  if (error instanceof AppError) {
    return error;
  }

  if (isReconnectRequiredError(error)) {
    return new AppError(
      "Google Calendar access denied. Make sure all calendars are shared with the service account email.",
      403,
      "google_calendar_access_denied"
    );
  }

  const status = extractGoogleStatus(error);
  const operationLabel = {
    list_calendars: "load Google calendars",
    read_events: "read Google Calendar events",
    read_freebusy: "read Google Calendar availability",
    create_event: "create a Google Calendar booking",
    delete_event: "remove a Google Calendar booking"
  }[operation];

  if (status === 429) {
    return new AppError(`Google Calendar is rate limiting requests right now. Unable to ${operationLabel}.`, 503, "google_calendar_rate_limited");
  }

  return new AppError(`Google Calendar is temporarily unavailable. Unable to ${operationLabel}.`, 503, "google_calendar_unavailable");
}

function clearEventCacheForCalendar(accountId: string, calendarId: string) {
  for (const key of eventCache.keys()) {
    if (key.startsWith(`${accountId}:${calendarId}:`)) {
      eventCache.delete(key);
    }
  }
}

export function clearEventCacheForAccount(accountId: string) {
  for (const key of eventCache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      eventCache.delete(key);
    }
  }
}

function logGoogleCalendarError(
  error: unknown,
  operation: GoogleCalendarOperation,
  context: Record<string, string | number | string[] | undefined> = {}
) {
  const status = extractGoogleStatus(error);
  const message = extractGoogleMessage(error);

  logger.error(
    {
      operation,
      googleStatus: status,
      googleError: message,
      ...context
    },
    "Google Calendar API error"
  );

  if (isReconnectRequiredError(error) && context.accountId) {
    monitoring.logCalendarError({
      accountId: String(context.accountId),
      operation,
      error: `Access denied — calendar not shared with service account: ${message}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Alert on critical operational errors
  if (context.accountId && (status === 503 || status === 429)) {
    monitoring.logCalendarError({
      accountId: String(context.accountId),
      operation,
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string | null;
};

export async function listGoogleCalendars(accountId: string): Promise<GoogleCalendarSummary[]> {
  try {
    const calendar = createCalendarClient();
    const response = await calendar.calendarList.list({
      minAccessRole: "reader",
      showHidden: true
    });

    return (response.data.items ?? [])
      .filter((item): item is calendar_v3.Schema$CalendarListEntry & { id: string; summary: string } => {
        return Boolean(item.id && item.summary);
      })
      .map((item) => ({
        id: item.id,
        summary: item.summary,
        primary: item.primary === true,
        accessRole: item.accessRole ?? null
      }));
  } catch (error) {
    logGoogleCalendarError(error, "list_calendars", { accountId });
    throw toCalendarAppError(error, "list_calendars");
  }
}

export async function fetchCalendarEvents(accountId: string, calendarId: string, timeMin: string, timeMax: string) {
  const cacheKey = [accountId, calendarId, timeMin, timeMax].join(":");
  const cached = eventCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.events;
  }

  try {
    const calendar = createCalendarClient();
    const response = await calendar.events.list(
      {
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500
      },
      {
        timeout: 3000
      }
    );

    const events = response.data.items ?? [];
    eventCache.set(cacheKey, {
      expiresAt: Date.now() + eventCacheTtlMs,
      events
    });

    return events;
  } catch (error) {
    logGoogleCalendarError(error, "read_events", { accountId, calendarId });
    throw toCalendarAppError(error, "read_events");
  }
}

export async function fetchFreeBusy(accountId: string, calendarIds: string[], timeMin: string, timeMax: string) {
  if (calendarIds.length === 0) {
    throw new AppError("At least one calendar ID is required", 400);
  }

  try {
    const calendar = createCalendarClient();
    const response = await calendar.freebusy.query(
      {
        requestBody: {
          timeMin,
          timeMax,
          items: calendarIds.map((id) => ({ id }))
        }
      },
      {
        timeout: 3000
      }
    );

    return response.data.calendars ?? {};
  } catch (error) {
    logGoogleCalendarError(error, "read_freebusy", { accountId, calendarIds });
    throw toCalendarAppError(error, "read_freebusy");
  }
}

export async function createCalendarEvent(input: {
  accountId: string;
  calendarId: string;
  summary: string;
  description?: string | null | undefined;
  startIso: string;
  endIso: string;
}) {
  try {
    const calendar = createCalendarClient();
    const response = await calendar.events.insert(
      {
        calendarId: input.calendarId,
        requestBody: {
          summary: input.summary,
          description: input.description ?? null,
          start: {
            dateTime: input.startIso,
            timeZone: "America/New_York"
          },
          end: {
            dateTime: input.endIso,
            timeZone: "America/New_York"
          }
        }
      },
      {
        timeout: 3000
      }
    );

    if (!response.data.id) {
      throw new AppError("Google Calendar did not return an event ID", 502, "google_calendar_unavailable");
    }

    clearEventCacheForCalendar(input.accountId, input.calendarId);
    return response.data;
  } catch (error) {
    logGoogleCalendarError(error, "create_event", { accountId: input.accountId, calendarId: input.calendarId });
    throw toCalendarAppError(error, "create_event");
  }
}

export async function deleteCalendarEvent(accountId: string, calendarId: string, eventId: string) {
  try {
    const calendar = createCalendarClient();

    await calendar.events.delete(
      {
        calendarId,
        eventId
      },
      {
        timeout: 3000
      }
    );
    clearEventCacheForCalendar(accountId, calendarId);
  } catch (error) {
    logGoogleCalendarError(error, "delete_event", { accountId, calendarId, eventId });
    throw toCalendarAppError(error, "delete_event");
  }
}
