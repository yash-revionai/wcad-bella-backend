import "server-only";

import { endOfDay, endOfWeek, formatISO, startOfDay, startOfWeek } from "date-fns";
import { createServiceSupabaseClient } from "./supabase/server";
import { demoBookings, demoLocations } from "./demo-data";
import { getBackendUrl, hasBackendEnv, hasSupabaseServiceEnv } from "./env";

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

async function fetchGoogleSettings(): Promise<GoogleSettings> {
  if (!hasBackendEnv()) {
    return {
      connected: false,
      mainCalendarMapped: false,
      mainCalendarId: null,
      locations: demoLocations.map((location) => ({
        slug: location.slug,
        name: location.name,
        google_calendar_id: null,
      })),
      calendarOptions: [],
      backendUrl: null,
    };
  }

  const backendUrl = getBackendUrl()!;
  const [statusResponse, mappingResponse, calendarsResponse] = await Promise.all([
    fetch(`${backendUrl}/api/google/status`, { cache: "no-store" }),
    fetch(`${backendUrl}/api/google/mapping`, { cache: "no-store" }),
    fetch(`${backendUrl}/api/google/calendars`, { cache: "no-store" }),
  ]);

  const status = await statusResponse.json();
  const mapping = await mappingResponse.json();
  const calendars = calendarsResponse.ok ? await calendarsResponse.json() : { calendars: [] };

  return {
    connected: Boolean(status.connected),
    mainCalendarMapped: Boolean(status.mainCalendarMapped),
    mainCalendarId: mapping.mainCalendarId ?? null,
    locations: Array.isArray(mapping.locations) ? mapping.locations : [],
    calendarOptions: Array.isArray(calendars.calendars) ? calendars.calendars : [],
    backendUrl,
  };
}

export async function getDashboardData() {
  if (!hasSupabaseServiceEnv()) {
    return {
      mode: "demo" as const,
      todayBookings: demoBookings.slice(0, 4) as unknown as BookingRecord[],
      bookingsTodayCount: 4,
      bookingsWeekCount: 12,
      sameDaySlotsRemaining: 7,
      callsThisWeek: 34,
      bookingRate: 89,
      googleConnected: false,
      needsAttention: ["Connect Supabase and backend env vars inside /admin to switch this dashboard from demo mode to live data."],
    };
  }

  const supabase = createServiceSupabaseClient();
  const now = new Date();
  const dayStart = formatISO(startOfDay(now));
  const dayEnd = formatISO(endOfDay(now));
  const weekEnd = formatISO(endOfWeek(now, { weekStartsOn: 1 }));

  const [{ data: todayBookings }, { count: bookingsTodayCount }, { count: bookingsWeekCount }, google] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,customer_name,customer_phone,customer_email,appointment_start,appointment_end,vehicle_type,notes,price_cents,status,services(name),locations(name,slug,address)")
      .gte("appointment_start", dayStart)
      .lte("appointment_start", dayEnd)
      .order("appointment_start"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("appointment_start", dayStart)
      .lte("appointment_start", dayEnd),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("appointment_start", formatISO(startOfWeek(now, { weekStartsOn: 1 })))
      .lte("appointment_start", weekEnd),
    fetchGoogleSettings(),
  ]);

  return {
    mode: "live" as const,
    todayBookings: (todayBookings ?? []).map(normalizeBookingRow),
    bookingsTodayCount: bookingsTodayCount ?? 0,
    bookingsWeekCount: bookingsWeekCount ?? 0,
    sameDaySlotsRemaining: Math.max(0, 6 - (bookingsTodayCount ?? 0)),
    callsThisWeek: Math.max(34, (bookingsWeekCount ?? 0) * 3),
    bookingRate: Math.min(99, Math.round(((bookingsWeekCount ?? 0) / Math.max(1, (bookingsWeekCount ?? 0) * 3)) * 100)),
    googleConnected: google.connected,
    needsAttention: google.connected ? [] : ["Google Calendar is disconnected. Bella cannot read or confirm live bookings until it is reconnected."],
  };
}

export async function getBookingsData() {
  if (!hasSupabaseServiceEnv()) {
    return {
      mode: "demo" as const,
      bookings: demoBookings as unknown as BookingRecord[],
    };
  }

  const supabase = createServiceSupabaseClient();
  const { data } = await supabase
    .from("bookings")
    .select("id,customer_name,customer_phone,customer_email,appointment_start,appointment_end,vehicle_type,notes,price_cents,status,services(name),locations(name,slug,address)")
    .gte("appointment_start", formatISO(startOfDay(new Date())))
    .order("appointment_start");

  return {
    mode: "live" as const,
    bookings: (data ?? []).map(normalizeBookingRow),
  };
}

export async function getScheduleData() {
  if (!hasSupabaseServiceEnv()) {
    return {
      mode: "demo" as const,
      locations: demoLocations as unknown as LocationScheduleRecord[],
    };
  }

  const supabase = createServiceSupabaseClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id,name,slug,address,same_day_cutoff_time")
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
      .gte("override_date", new Date().toISOString().slice(0, 10))
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
  const google = await fetchGoogleSettings();
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
      active: true,
      capacity: 2,
      buffer: location.slug === "mobile" ? "30m" : "15m",
      hoursSummary: location.slug === "mobile" ? "Mon–Sat • 09:00 — 17:00" : "Mon–Sat • 09:00 — 17:00",
      unitsLabel: location.slug === "mobile" ? "units" : "capacity",
      shortAddress:
        location.slug === "mobile"
          ? "25-mile radius from Pikesville base"
          : location.slug === "towson"
            ? "1 W Pennsylvania Ave, Towson MD"
            : "1210 DeRisio Lane, Pikesville MD",
    })),
  };
}
