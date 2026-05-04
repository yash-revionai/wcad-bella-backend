import type { calendar_v3 } from "googleapis";
import { DateTime } from "luxon";
import { AppError, isAppError } from "../lib/errors.js";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import { resolveAccount } from "./accounts.js";
import { fetchCalendarEvents } from "./calendar.js";
import type { LocationSlug, ServiceSlug, VehicleType } from "../config/constants.js";

const businessZone = "Asia/Kolkata";
const slotStepMinutes = 30;
const searchDays = 14;
const configCacheTtlMs = 10_000;
const availabilityConfigCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof loadAvailabilityConfigUncached>> }>();
const hoursCache = new Map<string, { expiresAt: number; value: { openTime: string; closeTime: string } | null }>();

export type AvailabilityRequest = {
  service: ServiceSlug;
  vehicleType: VehicleType;
  location: LocationSlug;
  preferredDate: string;
  accountId?: string | undefined;
};

export type BusyRange = {
  start: DateTime;
  end: DateTime;
};

type AvailabilityDependencies = {
  loadAvailabilityConfig: typeof loadAvailabilityConfig;
  loadHoursForDate: typeof loadHoursForDate;
  fetchCalendarEvents: typeof fetchCalendarEvents;
};

export type SlotGenerationInput = {
  date: DateTime;
  openTime: string;
  closeTime: string;
  durationMinutes: number;
  bufferMinutes: number;
  capacity: number;
  busyRanges: BusyRange[];
  now?: DateTime;
  sameDayCutoffTime?: string | null;
  locationSlug?: string;
};

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
};

type LocationRow = {
  id: string;
  name: string;
  slug: LocationSlug;
  google_calendar_id: string | null;
  capacity: number;
  buffer_minutes: number;
  same_day_cutoff_time: string | null;
};

type HoursRow = {
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
};

type OverrideRow = {
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
};

export function parsePreferredDate(value: string) {
  const date = DateTime.fromISO(value, { zone: businessZone });
  if (!date.isValid) {
    throw new AppError("Preferred date must be a valid ISO date.", 400);
  }

  return date.startOf("day");
}

function applyTime(date: DateTime, time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new AppError(`Invalid time value: ${time}`, 500);
  }

  return date.set({ hour, minute, second: 0, millisecond: 0 });
}

function rangesOverlap(aStart: DateTime, aEnd: DateTime, bStart: DateTime, bEnd: DateTime) {
  return aStart < bEnd && aEnd > bStart;
}

export function generateSlotsForDay(input: SlotGenerationInput) {
  const now = (input.now ?? DateTime.now()).setZone(businessZone);
  const date = input.date.setZone(businessZone).startOf("day");

  if (input.sameDayCutoffTime && date.hasSame(now, "day")) {
    const cutoff = applyTime(date, input.sameDayCutoffTime);
    if (now >= cutoff) {
      return [];
    }
  }

  const open = applyTime(date, input.openTime);
  const close = applyTime(date, input.closeTime);
  const latestStart = close.minus({ minutes: input.durationMinutes + input.bufferMinutes });

  if (latestStart < open) {
    return [];
  }

  const slots: DateTime[] = [];
  let candidate = open;

  if (date.hasSame(now, "day") && candidate < now) {
    const minutesSinceOpen = Math.max(0, Math.ceil(now.diff(open, "minutes").minutes));
    const steps = Math.ceil(minutesSinceOpen / slotStepMinutes);
    candidate = open.plus({ minutes: steps * slotStepMinutes });
  }

  while (candidate <= latestStart) {
    const candidateEndWithBuffer = candidate.plus({
      minutes: input.durationMinutes + input.bufferMinutes
    });

    const overlappingCount = input.busyRanges.filter((range) => {
      const busyEndWithBuffer = range.end.plus({ minutes: input.bufferMinutes });
      return rangesOverlap(candidate, candidateEndWithBuffer, range.start, busyEndWithBuffer);
    }).length;

    if (overlappingCount < input.capacity) {
      slots.push(candidate);
    }

    candidate = candidate.plus({ minutes: slotStepMinutes });
  }

  return slots;
}

export function googleEventsToBusyRanges(events: calendar_v3.Schema$Event[], date: DateTime): BusyRange[] {
  return events.flatMap((event) => {
    const startValue = event.start?.dateTime ?? event.start?.date;
    const endValue = event.end?.dateTime ?? event.end?.date;

    if (!startValue || !endValue) {
      return [];
    }

    const isAllDay = Boolean(event.start?.date || event.end?.date);
    const start = isAllDay
      ? DateTime.fromISO(startValue, { zone: businessZone }).startOf("day")
      : DateTime.fromISO(startValue).setZone(businessZone);
    const end = isAllDay
      ? DateTime.fromISO(endValue, { zone: businessZone }).startOf("day")
      : DateTime.fromISO(endValue).setZone(businessZone);

    if (!start.isValid || !end.isValid || end <= start) {
      return [];
    }

    const dayStart = date.startOf("day");
    const dayEnd = dayStart.plus({ days: 1 });

    if (!rangesOverlap(start, end, dayStart, dayEnd)) {
      return [];
    }

    return [{ start, end }];
  });
}

async function loadAvailabilityConfig(request: AvailabilityRequest) {
  const cacheKey = [request.accountId ?? "default", request.service, request.vehicleType, request.location].join(":");
  const cached = availabilityConfigCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await loadAvailabilityConfigUncached(request);
  availabilityConfigCache.set(cacheKey, {
    expiresAt: Date.now() + configCacheTtlMs,
    value
  });

  return value;
}

async function loadAvailabilityConfigUncached(request: AvailabilityRequest) {
  const supabase = createServiceSupabaseClient();
  const account = await resolveAccount(request.accountId);

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id,name,slug")
    .eq("account_id", account.id)
    .eq("slug", request.service)
    .eq("is_active", true)
    .single();

  if (serviceError || !service) {
    throw new AppError("I could not find that service. Let me take your details and have the team confirm it.", 200);
  }

  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("id,name,slug,google_calendar_id,capacity,buffer_minutes,same_day_cutoff_time")
    .eq("account_id", account.id)
    .eq("slug", request.location)
    .eq("is_active", true)
    .single();

  if (locationError || !location) {
    throw new AppError("I could not find that location. Let me take your details and have the team confirm it.", 200);
  }

  const { data: serviceLocation, error: serviceLocationError } = await supabase
    .from("service_locations")
    .select("service_id")
    .eq("service_id", service.id)
    .eq("location_id", location.id)
    .maybeSingle();

  if (serviceLocationError) {
    throw new AppError("I am having trouble checking that service right now. Let me take your details.", 200);
  }

  if (!serviceLocation) {
    throw new AppError(
      request.service === "ceramic_coating" && request.location === "mobile"
        ? "Ceramic coating is not available for mobile service. I can help find a shop appointment instead."
        : "That service is not available at the requested location. I can help check another location.",
      200
    );
  }

  const { data: duration, error: durationError } = await supabase
    .from("service_durations")
    .select("duration_minutes")
    .eq("service_id", service.id)
    .eq("vehicle_type", request.vehicleType)
    .single();

  if (durationError || !duration) {
    throw new AppError("I could not find the timing for that vehicle and service. Let me have the team confirm it.", 200);
  }

  if (!account.google_main_calendar_id || !location.google_calendar_id) {
    throw new AppError(
      "The calendar setup is not complete yet, so I cannot check live availability. Could I take your name and number for a callback?",
      200
    );
  }

  return {
    account,
    service: service as ServiceRow,
    location: location as LocationRow,
    durationMinutes: Number(duration.duration_minutes)
  };
}

async function loadHoursForDate(locationId: string, date: DateTime) {
  const cacheKey = [locationId, date.toISODate()].join(":");
  const cached = hoursCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const supabase = createServiceSupabaseClient();
  const dayOfWeek = date.weekday % 7;
  const dateString = date.toISODate();

  const [{ data: hours, error: hoursError }, { data: override, error: overrideError }] = await Promise.all([
    supabase
      .from("location_hours")
      .select("open_time,close_time,is_closed")
      .eq("location_id", locationId)
      .eq("day_of_week", dayOfWeek)
      .single(),
    supabase
      .from("location_overrides")
      .select("open_time,close_time,is_closed")
      .eq("location_id", locationId)
      .eq("override_date", dateString)
      .maybeSingle()
  ]);

  if (hoursError || !hours) {
    throw new AppError("I cannot check that day's hours right now. Let me take your details for a callback.", 200);
  }

  if (overrideError) {
    throw new AppError("I cannot check schedule overrides right now. Let me take your details for a callback.", 200);
  }

  const resolved = override ? (override as OverrideRow) : (hours as HoursRow);

  if (resolved.is_closed || !resolved.open_time || !resolved.close_time) {
    hoursCache.set(cacheKey, {
      expiresAt: Date.now() + configCacheTtlMs,
      value: null
    });
    return null;
  }

  const value = {
    openTime: resolved.open_time,
    closeTime: resolved.close_time
  };

  hoursCache.set(cacheKey, {
    expiresAt: Date.now() + configCacheTtlMs,
    value
  });

  return value;
}

function dayBounds(date: DateTime) {
  const start = date.startOf("day");
  const end = start.plus({ days: 1 });

  return {
    timeMin: start.toUTC().toISO({ suppressMilliseconds: true })!,
    timeMax: end.toUTC().toISO({ suppressMilliseconds: true })!
  };
}

function formatSlotForSpeech(slot: DateTime) {
  return slot.toFormat("cccc 'at' h:mm a");
}

function buildAvailabilityMessage(serviceName: string, locationName: string, slots: DateTime[]) {
  if (slots.length === 0) {
    return `I do not see any open ${serviceName} appointments at ${locationName} in the next two weeks. I can take your details and have the team call you back.`;
  }

  const spokenSlots = slots.slice(0, 3).map(formatSlotForSpeech);
  const slotText =
    spokenSlots.length === 1
      ? spokenSlots[0]
      : `${spokenSlots.slice(0, -1).join(", ")}, or ${spokenSlots.at(-1)}`;

  return `I found a few open slots for ${serviceName} at ${locationName}. I have ${slotText}. Which works best for you?`;
}

function isGoogleCalendarFailure(error: unknown) {
  return isAppError(error) && typeof error.code === "string" && error.code.startsWith("google_calendar_");
}

const defaultAvailabilityDependencies: AvailabilityDependencies = {
  loadAvailabilityConfig,
  loadHoursForDate,
  fetchCalendarEvents
};

export async function checkAvailability(
  request: AvailabilityRequest,
  dependencies: AvailabilityDependencies = defaultAvailabilityDependencies
) {
  try {
    const preferredDate = parsePreferredDate(request.preferredDate);
    const { account, service, location, durationMinutes } = await dependencies.loadAvailabilityConfig(request);
    const candidateDates = Array.from({ length: searchDays }, (_value, dayOffset) => preferredDate.plus({ days: dayOffset }));
    const hoursByDate = await Promise.all(
      candidateDates.map(async (date) => ({
        date,
        hours: await dependencies.loadHoursForDate(location.id, date)
      }))
    );

    const slotsByDay = await Promise.all(
      hoursByDate
        .filter((entry): entry is { date: DateTime; hours: { openTime: string; closeTime: string } } => Boolean(entry.hours))
        .map(async ({ date, hours }) => {
          const { timeMin, timeMax } = dayBounds(date);
          const [locationEvents, mainEvents] = await Promise.all([
            dependencies.fetchCalendarEvents(account.id, location.google_calendar_id!, timeMin, timeMax),
            dependencies.fetchCalendarEvents(account.id, account.google_main_calendar_id!, timeMin, timeMax)
          ]);

          const busyRanges = [
            ...googleEventsToBusyRanges(locationEvents, date),
            ...googleEventsToBusyRanges(mainEvents, date)
          ];

          return generateSlotsForDay({
            date,
            openTime: hours.openTime,
            closeTime: hours.closeTime,
            durationMinutes,
            bufferMinutes: location.buffer_minutes,
            capacity: location.capacity,
            busyRanges,
            sameDayCutoffTime: location.same_day_cutoff_time,
            locationSlug: location.slug
          });
        })
    );

    const collectedSlots = slotsByDay.flat();

    const slots = collectedSlots.slice(0, 5);

    return {
      result: buildAvailabilityMessage(service.name, location.name, slots),
      slots: slots.map((slot) => slot.toISO({ suppressMilliseconds: true })),
      agentReaction: "speaks-once"
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 200) {
      return {
        result: error.message,
        slots: [],
        agentReaction: "speaks-once"
      };
    }

    if (isGoogleCalendarFailure(error)) {
      return {
        result:
          "I'm having trouble checking live calendar availability right now. Could I take your name and number and have a team member call you back?",
        slots: [],
        agentReaction: "speaks-once"
      };
    }

    throw error;
  }
}
