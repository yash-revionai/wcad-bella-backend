import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { AppError, isAppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { monitoring } from "../lib/monitoring.js";
import { normalizeUsPhoneNumber } from "../lib/phone.js";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import type { LocationSlug, ServiceSlug, VehicleType } from "../config/constants.js";
import { resolveAccount } from "./accounts.js";
import { createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents } from "./calendar.js";
import { generateSlotsForDay, googleEventsToBusyRanges } from "./availability.js";
import { sendEmailConfirmation, sendSmsConfirmation } from "./notifications.js";

const businessZone = "Asia/Kolkata";

export type BookingRequest = {
  callerName: string;
  callerPhone: string;
  callerEmail?: string | null | undefined;
  service: ServiceSlug;
  vehicleType: VehicleType;
  location: LocationSlug;
  appointmentStart: string;
  idempotencyKey?: string | undefined;
  notes?: string | null | undefined;
  accountId?: string | undefined;
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
  address: string | null;
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

type BookingDependencies = {
  loadBookingConfig: typeof loadBookingConfig;
  assertSlotStillAvailable: typeof assertSlotStillAvailable;
  createCalendarEvent: typeof createCalendarEvent;
  deleteCalendarEvent: typeof deleteCalendarEvent;
  createServiceSupabaseClient: typeof createServiceSupabaseClient;
  sendSmsConfirmation: typeof sendSmsConfirmation;
  sendEmailConfirmation: typeof sendEmailConfirmation;
};

function parseAppointmentStart(value: string) {
  const date = DateTime.fromISO(value, { zone: businessZone });
  if (!date.isValid) {
    throw new AppError("Appointment start must be a valid ISO 8601 datetime.", 400);
  }

  return date.setZone(businessZone);
}

function applyTime(date: DateTime, time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return date.set({ hour, minute, second: 0, millisecond: 0 });
}

function buildCalendarDescription(input: {
  serviceName: string;
  vehicleType: VehicleType;
  locationName: string;
  notes?: string | null;
}) {
  return [
    `Service: ${input.serviceName}`,
    `Vehicle: ${input.vehicleType}`,
    `Location: ${input.locationName}`,
    input.notes ? `Notes: ${input.notes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBookingIdempotencyKey(input: {
  accountId: string;
  locationId: string;
  serviceId: string;
  vehicleType: VehicleType;
  customerPhone: string;
  appointmentStartUtc: string;
  clientKey?: string | undefined;
}) {
  if (input.clientKey) {
    return `client:${input.clientKey}`;
  }

  return createHash("sha256")
    .update(
      [
        input.accountId,
        input.locationId,
        input.serviceId,
        input.vehicleType,
        input.customerPhone,
        input.appointmentStartUtc
      ].join("|")
    )
    .digest("hex");
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function findExistingBookingByIdempotencyKey(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  accountId: string,
  idempotencyKey: string
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("account_id", accountId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string } | null;
}

function bookingConfirmedResponse(bookingId: string, hasCustomerEmail = false) {
  const confirmationChannelText = hasCustomerEmail ? "by text and email shortly" : "by text shortly";

  return {
    result: `The appointment is confirmed. Let the caller know their booking is set, they will receive a confirmation ${confirmationChannelText}, and that a credit card is needed to hold the appointment but there is no charge until after the service is complete.`,
    bookingId,
    agentReaction: "speaks-once"
  };
}

async function loadHoursForDate(locationId: string, date: DateTime) {
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
    throw new AppError("I was unable to confirm the schedule for that day. Let me take your details for a callback.", 200);
  }

  if (overrideError) {
    throw new AppError("I was unable to confirm special schedule changes for that day. Let me take your details for a callback.", 200);
  }

  const resolved = (override as OverrideRow | null) ?? (hours as HoursRow);
  if (resolved.is_closed || !resolved.open_time || !resolved.close_time) {
    throw new AppError("That location is closed at the requested time. Let me find another opening for you.", 200);
  }

  return {
    openTime: resolved.open_time,
    closeTime: resolved.close_time
  };
}

async function loadBookingConfig(request: BookingRequest) {
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
    .select("id,name,slug,address,google_calendar_id,capacity,buffer_minutes,same_day_cutoff_time")
    .eq("account_id", account.id)
    .eq("slug", request.location)
    .eq("is_active", true)
    .single();

  if (locationError || !location) {
    throw new AppError("I could not find that location. Let me take your details and have the team confirm it.", 200);
  }

  const [{ data: serviceLocation, error: serviceLocationError }, { data: duration, error: durationError }, { data: price, error: priceError }] =
    await Promise.all([
      supabase
        .from("service_locations")
        .select("service_id")
        .eq("service_id", service.id)
        .eq("location_id", location.id)
        .maybeSingle(),
      supabase
        .from("service_durations")
        .select("duration_minutes")
        .eq("service_id", service.id)
        .eq("vehicle_type", request.vehicleType)
        .single(),
      supabase
        .from("pricing")
        .select("price_cents")
        .eq("service_id", service.id)
        .eq("vehicle_type", request.vehicleType)
        .maybeSingle()
    ]);

  if (serviceLocationError || !serviceLocation) {
    throw new AppError("That service is not available at the requested location. I can help check another location.", 200);
  }

  if (durationError || !duration) {
    throw new AppError("I could not confirm the timing for that vehicle and service. Let me take your details.", 200);
  }

  if (priceError) {
    throw new AppError("I could not confirm pricing for that service right now. Let me take your details.", 200);
  }

  if (!account.google_main_calendar_id || !location.google_calendar_id) {
    throw new AppError(
      "The calendar setup is not complete yet, so I cannot confirm live bookings right now. Could I take your name and number for a callback?",
      200
    );
  }

  return {
    account,
    service: service as ServiceRow,
    location: location as LocationRow,
    durationMinutes: Number(duration.duration_minutes),
    priceCents: price ? Number(price.price_cents) : null
  };
}

async function assertSlotStillAvailable(config: Awaited<ReturnType<typeof loadBookingConfig>>, appointmentStart: DateTime) {
  const hours = await loadHoursForDate(config.location.id, appointmentStart.startOf("day"));
  const appointmentEnd = appointmentStart.plus({ minutes: config.durationMinutes });
  const latestStart = applyTime(appointmentStart.startOf("day"), hours.closeTime).minus({
    minutes: config.durationMinutes + config.location.buffer_minutes
  });

  if (appointmentStart < applyTime(appointmentStart.startOf("day"), hours.openTime) || appointmentStart > latestStart) {
    throw new AppError("That requested time is outside the location's available hours. Let me find another option.", 200);
  }

  if (config.location.same_day_cutoff_time && appointmentStart.hasSame(DateTime.now().setZone(businessZone), "day")) {
    const cutoff = applyTime(appointmentStart.startOf("day"), config.location.same_day_cutoff_time);
    if (DateTime.now().setZone(businessZone) >= cutoff) {
      throw new AppError("Same-day mobile booking is no longer available right now. Let me find the next opening.", 200);
    }
  }

  const dayStart = appointmentStart.startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });

  const [locationEvents, mainEvents] = await Promise.all([
    fetchCalendarEvents(
      config.account.id,
      config.location.google_calendar_id!,
      dayStart.toUTC().toISO({ suppressMilliseconds: true })!,
      dayEnd.toUTC().toISO({ suppressMilliseconds: true })!
    ),
    fetchCalendarEvents(
      config.account.id,
      config.account.google_main_calendar_id!,
      dayStart.toUTC().toISO({ suppressMilliseconds: true })!,
      dayEnd.toUTC().toISO({ suppressMilliseconds: true })!
    )
  ]);

  const busyRanges = [
    ...googleEventsToBusyRanges(locationEvents, appointmentStart),
    ...googleEventsToBusyRanges(mainEvents, appointmentStart)
  ];

  const availableSlots = generateSlotsForDay({
    date: appointmentStart.startOf("day"),
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    durationMinutes: config.durationMinutes,
    bufferMinutes: config.location.buffer_minutes,
    capacity: config.location.capacity,
    busyRanges,
    sameDayCutoffTime: config.location.same_day_cutoff_time
  });

  const slotStillOpen = availableSlots.some((slot) => slot.toMillis() === appointmentStart.toMillis());
  if (!slotStillOpen) {
    throw new AppError("It looks like that slot was just taken. Let me find you the next available time.", 200);
  }

  return appointmentEnd;
}

export async function confirmBooking(request: BookingRequest) {
  return confirmBookingWithDependencies(request, {
    loadBookingConfig,
    assertSlotStillAvailable,
    createCalendarEvent,
    deleteCalendarEvent,
    createServiceSupabaseClient,
    sendSmsConfirmation,
    sendEmailConfirmation
  });
}

function isGoogleCalendarFailure(error: unknown) {
  return isAppError(error) && typeof error.code === "string" && error.code.startsWith("google_calendar_");
}

export async function confirmBookingWithDependencies(request: BookingRequest, dependencies: BookingDependencies) {
  try {
    const appointmentStart = parseAppointmentStart(request.appointmentStart);
    const normalizedPhone = normalizeUsPhoneNumber(request.callerPhone);
    const config = await dependencies.loadBookingConfig(request);
    const appointmentEnd = await dependencies.assertSlotStillAvailable(config, appointmentStart);
    const appointmentStartUtc = appointmentStart.toUTC().toISO({ suppressMilliseconds: true })!;
    const supabase = dependencies.createServiceSupabaseClient();
    const idempotencyKey = buildBookingIdempotencyKey({
      accountId: config.account.id,
      locationId: config.location.id,
      serviceId: config.service.id,
      vehicleType: request.vehicleType,
      customerPhone: normalizedPhone,
      appointmentStartUtc,
      clientKey: request.idempotencyKey
    });
    const existingBooking = await findExistingBookingByIdempotencyKey(supabase, config.account.id, idempotencyKey);

    if (existingBooking) {
      logger.info({ bookingId: existingBooking.id, idempotencyKey }, "Booking idempotency replayed");
      return bookingConfirmedResponse(existingBooking.id, Boolean(request.callerEmail));
    }

    const calendarEvent = await dependencies.createCalendarEvent({
      accountId: config.account.id,
      calendarId: config.location.google_calendar_id!,
      summary: `${config.service.name} - ${request.callerName}`,
      description: buildCalendarDescription({
        serviceName: config.service.name,
        vehicleType: request.vehicleType,
        locationName: config.location.name,
        notes: request.notes ?? null
      }),
      startIso: appointmentStart.toISO({ suppressMilliseconds: true })!,
      endIso: appointmentEnd.toISO({ suppressMilliseconds: true })!
    });

    let bookingId: string;

    try {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          account_id: config.account.id,
          location_id: config.location.id,
          service_id: config.service.id,
          vehicle_type: request.vehicleType,
          customer_name: request.callerName,
          customer_phone: normalizedPhone,
          customer_email: request.callerEmail ?? null,
          appointment_start: appointmentStartUtc,
          appointment_end: appointmentEnd.toUTC().toISO({ suppressMilliseconds: true }),
          duration_minutes: config.durationMinutes,
          google_event_id: calendarEvent.id,
          notes: request.notes ?? null,
          price_cents: config.priceCents,
          idempotency_key: idempotencyKey
        })
        .select("id")
        .single();

      if (bookingError || !booking) {
        if (isUniqueConstraintError(bookingError)) {
          const duplicateBooking = await findExistingBookingByIdempotencyKey(supabase, config.account.id, idempotencyKey);
          if (duplicateBooking) {
            try {
              await dependencies.deleteCalendarEvent(config.account.id, config.location.google_calendar_id!, calendarEvent.id!);
            } catch (cleanupError) {
              logger.error({ error: cleanupError, calendarEventId: calendarEvent.id }, "Duplicate booking calendar cleanup failed");
            }
            bookingId = duplicateBooking.id;
            return bookingConfirmedResponse(bookingId, Boolean(request.callerEmail));
          }
        }

        throw new Error(bookingError?.message ?? "Unknown booking insert failure");
      }

      bookingId = booking.id;
    } catch (error) {
      try {
        await dependencies.deleteCalendarEvent(config.account.id, config.location.google_calendar_id!, calendarEvent.id!);
      } catch (cleanupError) {
        logger.error({ error: cleanupError, calendarEventId: calendarEvent.id }, "Booking rollback calendar cleanup failed");
      }
      throw error;
    }

    const confirmationDetails = {
      customerName: request.callerName,
      customerPhone: normalizedPhone,
      customerEmail: request.callerEmail ?? null,
      serviceName: config.service.name,
      vehicleType: request.vehicleType,
      locationName: config.location.name,
      locationAddress: config.location.address,
      appointmentStartIso: appointmentStart.toISO({ suppressMilliseconds: true })!
    };

    let confirmationSmsSent = false;
    let confirmationEmailSent = false;
    let smsError: Error | null = null;
    let emailError: Error | null = null;

    try {
      confirmationSmsSent = await dependencies.sendSmsConfirmation(confirmationDetails);
    } catch (error) {
      smsError = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: smsError, bookingId }, "SMS confirmation failed");
      monitoring.logSmsFailure({
        to: normalizedPhone,
        message: `${config.service.name} on ${appointmentStart.toLocaleString()}`,
        error: smsError.message,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      confirmationEmailSent = await dependencies.sendEmailConfirmation(confirmationDetails);
    } catch (error) {
      emailError = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: emailError, bookingId }, "Email confirmation failed");
      if (request.callerEmail) {
        monitoring.logEmailFailure({
          to: request.callerEmail,
          subject: `${config.service.name} Appointment Confirmation - ${appointmentStart.toLocaleString()}`,
          error: emailError.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Alert if both confirmations failed
    if (!confirmationSmsSent && !confirmationEmailSent) {
      monitoring.logConfirmationFailure({
        bookingId,
        customerId: config.account.id,
        customerPhone: normalizedPhone,
        service: config.service.name,
        location: config.location.name,
        appointmentStart: appointmentStart.toISO({ suppressMilliseconds: true })!,
        failureType: "both",
        failureMessage: `SMS error: ${smsError?.message}; Email error: ${emailError?.message}`,
        timestamp: new Date().toISOString(),
      });
    } else if (!confirmationSmsSent && smsError) {
      monitoring.logConfirmationFailure({
        bookingId,
        customerId: config.account.id,
        customerPhone: normalizedPhone,
        service: config.service.name,
        location: config.location.name,
        appointmentStart: appointmentStart.toISO({ suppressMilliseconds: true })!,
        failureType: "sms",
        failureMessage: smsError.message,
        timestamp: new Date().toISOString(),
      });
    } else if (!confirmationEmailSent && emailError) {
      monitoring.logConfirmationFailure({
        bookingId,
        customerId: config.account.id,
        customerPhone: normalizedPhone,
        service: config.service.name,
        location: config.location.name,
        appointmentStart: appointmentStart.toISO({ suppressMilliseconds: true })!,
        failureType: "email",
        failureMessage: emailError.message,
        timestamp: new Date().toISOString(),
      });
    }

    await supabase
      .from("bookings")
      .update({
        confirmation_sms_sent: confirmationSmsSent,
        confirmation_email_sent: confirmationEmailSent
      })
      .eq("id", bookingId);

    logger.info(
      {
        bookingId,
        accountId: config.account.id,
        locationId: config.location.id,
        serviceId: config.service.id,
        appointmentStart: appointmentStart.toUTC().toISO({ suppressMilliseconds: true }),
        confirmationSmsSent,
        confirmationEmailSent
      },
      "Booking confirmed"
    );

    return bookingConfirmedResponse(bookingId, Boolean(request.callerEmail));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 200) {
      return {
        result: error.message,
        agentReaction: "speaks-once"
      };
    }

    if (isGoogleCalendarFailure(error)) {
      return {
        result:
          "I was unable to confirm that booking in the calendar right now. Could I take your details and have a team member confirm it with you?",
        agentReaction: "speaks-once"
      };
    }

    logger.error({ error, requestBody: request }, "Booking confirmation failed");
    return {
      result:
        "I was unable to save your booking right now. Could I take your details and have a team member confirm this with you?",
      agentReaction: "speaks-once"
    };
  }
}
