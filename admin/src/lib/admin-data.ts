import "server-only";

import { getAuthorizedAdminAccountId } from "./admin-auth";
import { createServiceSupabaseClient } from "./supabase/server";
import { getBackendAdminHeaders, getBackendEnvIssue, getBackendUrl, hasBackendEnv, type BackendEnvIssue } from "./env";
import { businessDateOnly, businessDayRangeIso, businessWeekRangeIso } from "./timezone";

export type BookingRecord = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  appointment_start: string;
  appointment_end: string;
  vehicle_type: string;
  notes: string | null;
  price_cents: number | null;
  status: string;
  services: { name: string } | null;
  locations: { name: string; slug: string; address: string | null } | null;
};

export type LocationScheduleRecord = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  same_day_cutoff_time: string | null;
  capacity: number;
  buffer_minutes: number;
  is_active: boolean | null;
  hours: Array<{
    day_of_week: number;
    is_closed: boolean | null;
    open_time: string | null;
    close_time: string | null;
  }>;
  overrides: Array<{
    override_date: string;
    is_closed: boolean | null;
    open_time?: string | null;
    close_time?: string | null;
    reason?: string | null;
  }>;
};

export type GoogleSettings = {
  connected: boolean;
  mainCalendarMapped: boolean;
  mainCalendarId: string | null;
  locations: Array<{ slug: string; name: string; google_calendar_id: string | null }>;
  calendarOptions: Array<{ id: string; summary: string; primary: boolean; accessRole: string | null }>;
  connectedAccountEmail: string | null;
  connectedAccountName: string | null;
  backendIssue: BackendEnvIssue | null;
  backendUrl: string | null;
};

type RawBookingRow = {
  id: string | number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  appointment_start: string | null;
  appointment_end: string | null;
  vehicle_type: string | null;
  notes: string | null;
  price_cents: number | null;
  status: string | null;
  services: { name: string | null } | Array<{ name: string | null }> | null;
  locations:
    | { name: string | null; slug: string | null; address: string | null }
    | Array<{ name: string | null; slug: string | null; address: string | null }>
    | null;
};

function normalizeBookingRow(row: RawBookingRow): BookingRecord {
  const serviceValue = Array.isArray(row.services) ? row.services[0] : row.services;
  const locationValue = Array.isArray(row.locations) ? row.locations[0] : row.locations;

  return {
    id: String(row.id),
    customer_name: String(row.customer_name),
    customer_phone: String(row.customer_phone),
    customer_email: row.customer_email ?? null,
    appointment_start: String(row.appointment_start),
    appointment_end: String(row.appointment_end),
    vehicle_type: String(row.vehicle_type),
    notes: row.notes ?? null,
    price_cents: typeof row.price_cents === "number" ? row.price_cents : null,
    status: String(row.status),
    services: serviceValue ? { name: String(serviceValue.name) } : null,
    locations: locationValue
      ? {
          name: String(locationValue.name),
          slug: String(locationValue.slug),
          address: locationValue.address ?? null,
        }
      : null,
  };
}

async function fetchGoogleSettings(accountId: string | null): Promise<GoogleSettings> {
  const disconnectedSettings = {
    connected: false,
    mainCalendarMapped: false,
    mainCalendarId: null,
    locations: [],
    calendarOptions: [],
    connectedAccountEmail: null,
    connectedAccountName: null,
    backendIssue: getBackendEnvIssue(),
    backendUrl: null,
  } satisfies GoogleSettings;

  const backendHeaders = getBackendAdminHeaders();
  if (!hasBackendEnv() || !backendHeaders || !accountId) {
    return disconnectedSettings;
  }

  const backendUrl = getBackendUrl()!;
  const accountQuery = new URLSearchParams({ accountId });
  let statusResponse: Response;
  let mappingResponse: Response;

  try {
    [statusResponse, mappingResponse] = await Promise.all([
      fetch(`${backendUrl}/api/google/status?${accountQuery}`, { cache: "no-store", headers: backendHeaders }),
      fetch(`${backendUrl}/api/google/mapping?${accountQuery}`, { cache: "no-store", headers: backendHeaders }),
    ]);
  } catch {
    return { ...disconnectedSettings, backendUrl };
  }

  if (!statusResponse.ok || !mappingResponse.ok) {
    return { ...disconnectedSettings, backendUrl };
  }

  const status = await statusResponse.json();
  const mapping = await mappingResponse.json();
  let calendarOptions: GoogleSettings["calendarOptions"] = [];
  let connected = Boolean(status.connected);

  if (connected) {
    let calendarsResponse: Response;

    try {
      calendarsResponse = await fetch(`${backendUrl}/api/google/calendars?${accountQuery}`, {
        cache: "no-store",
        headers: backendHeaders,
      });
    } catch {
      calendarsResponse = new Response(null, { status: 503 });
    }

    if (calendarsResponse.ok) {
      const calendars = await calendarsResponse.json();
      calendarOptions = Array.isArray(calendars.calendars) ? calendars.calendars : [];
    } else if (calendarsResponse.status === 409) {
      connected = false;
    }
  }

  const primaryCalendar = calendarOptions.find((calendar) => calendar.primary);
  const connectedAccountEmail = primaryCalendar?.id.includes("@") ? primaryCalendar.id : null;

  return {
    connected,
    mainCalendarMapped: connected && Boolean(status.mainCalendarMapped),
    mainCalendarId: mapping.mainCalendarId ?? null,
    locations: Array.isArray(mapping.locations) ? mapping.locations : [],
    calendarOptions,
    connectedAccountEmail,
    connectedAccountName: primaryCalendar?.summary ?? null,
    backendIssue: null,
    backendUrl,
  };
}

export async function getDashboardData() {
  const accountId = await getAuthorizedAdminAccountId();
  const supabase = createServiceSupabaseClient();
  const dayRange = businessDayRangeIso();
  const weekRange = businessWeekRangeIso();

  const [{ data: todayBookings }, { count: bookingsTodayCount }, { data: weekBookings, count: bookingsWeekCount }, google] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,customer_name,customer_phone,customer_email,appointment_start,appointment_end,vehicle_type,notes,price_cents,status,services(name),locations(name,slug,address)")
      .eq("account_id", accountId)
      .gte("appointment_start", dayRange.start)
      .lte("appointment_start", dayRange.end)
      .order("appointment_start"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .gte("appointment_start", dayRange.start)
      .lte("appointment_start", dayRange.end),
    supabase
      .from("bookings")
      .select("id,price_cents", { count: "exact" })
      .eq("account_id", accountId)
      .gte("appointment_start", weekRange.start)
      .lte("appointment_start", weekRange.end),
    fetchGoogleSettings(accountId),
  ]);
  const revenueThisWeekCents = (weekBookings ?? []).reduce((sum, booking) => sum + (booking.price_cents ?? 0), 0);

  return {
    mode: "live" as const,
    todayBookings: (todayBookings ?? []).map(normalizeBookingRow),
    bookingsTodayCount: bookingsTodayCount ?? 0,
    bookingsWeekCount: bookingsWeekCount ?? 0,
    revenueThisWeekCents,
    calendarReady:
      google.connected &&
      google.mainCalendarMapped &&
      google.locations.length >= 3 &&
      google.locations.every((location) => Boolean(location.google_calendar_id)),
    googleConnected: google.connected,
    needsAttention:
      google.connected && google.mainCalendarMapped
        ? []
        : ["Google Calendar is not fully connected and mapped. Bella cannot read or confirm live bookings until setup is complete."],
  };
}

export async function getBookingsData() {
  const accountId = await getAuthorizedAdminAccountId();
  const supabase = createServiceSupabaseClient();
  const { data } = await supabase
    .from("bookings")
    .select("id,customer_name,customer_phone,customer_email,appointment_start,appointment_end,vehicle_type,notes,price_cents,status,services(name),locations(name,slug,address)")
    .eq("account_id", accountId)
    .gte("appointment_start", businessDayRangeIso().start)
    .order("appointment_start");

  return {
    mode: "live" as const,
    bookings: (data ?? []).map(normalizeBookingRow),
  };
}

export async function getScheduleData() {
  const accountId = await getAuthorizedAdminAccountId();
  const supabase = createServiceSupabaseClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id,name,slug,address,same_day_cutoff_time,capacity,buffer_minutes,is_active")
    .eq("account_id", accountId)
    .order("name");

  const locationIds = (locations ?? []).map((location) => location.id);
  const [{ data: hours }, { data: overrides }] = await Promise.all([
    supabase
      .from("location_hours")
      .select("location_id,day_of_week,is_closed,open_time,close_time")
      .in("location_id", locationIds)
      .order("day_of_week"),
    supabase
      .from("location_overrides")
      .select("location_id,override_date,is_closed,open_time,close_time,reason")
      .in("location_id", locationIds)
      .gte("override_date", businessDateOnly())
      .order("override_date"),
  ]);

  return {
    mode: "live" as const,
    locations: (locations ?? []).map((location) => ({
      ...location,
      hours: (hours ?? []).filter((row) => row.location_id === location.id),
      overrides: (overrides ?? []).filter((row) => row.location_id === location.id),
    })) as LocationScheduleRecord[],
  };
}

export async function getSettingsData() {
  const accountId = await getAuthorizedAdminAccountId();
  const google = await fetchGoogleSettings(accountId);
  const schedule = await getScheduleData();

  return {
    mode: schedule.mode,
    google,
    locations: schedule.locations,
    notifications: {
      emailEnabled: Boolean(process.env.RESEND_API_KEY),
      smsEnabled: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
    },
  };
}

export async function getLocationsData() {
  const schedule = await getScheduleData();

  return {
    mode: schedule.mode,
    locations: schedule.locations.map((location) => ({
      ...location,
      active: location.is_active !== false,
      capacity: location.capacity,
      buffer: `${location.buffer_minutes}m`,
      hoursSummary: summarizeHours(location.hours),
      unitsLabel: location.slug === "mobile" ? "units" : "capacity",
      shortAddress: location.address ?? "No address saved",
    })),
  };
}

function summarizeHours(hours: LocationScheduleRecord["hours"]) {
  const openDays = hours.filter((hour) => !hour.is_closed && hour.open_time && hour.close_time);
  if (openDays.length === 0) {
    return "Closed";
  }

  const sameHours = openDays.every((hour) => hour.open_time === openDays[0]?.open_time && hour.close_time === openDays[0]?.close_time);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daySummary =
    openDays.length === 6 && openDays.every((hour) => hour.day_of_week >= 1 && hour.day_of_week <= 6)
      ? "Mon-Sat"
      : openDays.map((hour) => dayNames[hour.day_of_week]).join(", ");

  if (!sameHours) {
    return `${daySummary} - varied hours`;
  }

  return `${daySummary} - ${openDays[0]?.open_time} to ${openDays[0]?.close_time}`;
}
