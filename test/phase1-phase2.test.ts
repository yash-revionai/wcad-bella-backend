import assert from "node:assert/strict";
import test from "node:test";
import { DateTime } from "luxon";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AppError } from "../src/lib/errors.js";
import { normalizeUsPhoneNumber } from "../src/lib/phone.js";
import { checkAvailability, generateSlotsForDay, googleEventsToBusyRanges } from "../src/services/availability.js";
import { confirmBookingWithDependencies } from "../src/services/booking.js";

const app = createApp();
const bellaApiKey = process.env.BELLA_API_KEY!;
const adminApiKey = process.env.ADMIN_API_KEY!;
const mockAccount = {
  id: "account-1",
  business_name: "World Class Auto Detail",
  email: "worldclassautodetail@gmail.com",
  google_refresh_token_encrypted: null,
  google_access_token_encrypted: null,
  google_token_expiry: null,
  google_main_calendar_id: "main-calendar"
};

function createNoExistingBookingSupabaseClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        })
      })
    })
  };
}

test("GET /api/health returns service status", async () => {
  const response = await request(app).get("/api/health").expect(200);

  assert.equal(response.body.status, "ok");
  assert.equal(response.body.service, "wcad-bella-backend");
  assert.match(response.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("GET /api/time returns current business time for Bella", async () => {
  const response = await request(app).get("/api/time").set("x-api-key", bellaApiKey).expect(200);

  assert.equal(response.body.timezone, "Asia/Kolkata");
  assert.match(response.body.nowIso, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(response.body.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(response.body.tomorrow, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(response.body.mobileSameDayCutoffTime, "14:00");
  assert.equal(typeof response.body.isAfterMobileSameDayCutoff, "boolean");
  assert.match(response.body.result, /current business date/i);
});

test("GET /api/time requires Bella API key", async () => {
  const response = await request(app).get("/api/time").expect(401);
  assert.equal(response.body.error, "Unauthorized");
});

test("unknown routes return 404", async () => {
  const response = await request(app).get("/api/not-real").expect(404);
  assert.equal(response.body.error, "Not found");
});

test("Google OAuth start redirects when credentials are configured", async () => {
  const response = await request(app).get("/api/auth/google").set("x-admin-api-key", adminApiKey).expect(302);
  const location = response.headers.location;
  assert.ok(location);
  const redirectUrl = location;
  assert.match(redirectUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(redirectUrl, /calendar\.readonly/);
  assert.match(redirectUrl, /calendar\.events/);
  assert.match(redirectUrl, /state=[^&]+\.[^&]+/);
});

test("Google OAuth start requires admin API key", async () => {
  const response = await request(app).get("/api/auth/google").expect(401);
  assert.equal(response.body.error, "Unauthorized");
});

test("Google mapping update validates required location mappings", async () => {
  const response = await request(app)
    .put("/api/google/mapping")
    .set("x-admin-api-key", adminApiKey)
    .send({ mainCalendarId: "primary", locations: { pikesville: "pikesville-calendar" } })
    .expect(400);

  assert.equal(response.body.error, "Invalid request body");
});

test("Google admin routes require admin API key", async () => {
  const response = await request(app)
    .put("/api/google/mapping")
    .send({ mainCalendarId: "primary", locations: { pikesville: "pikesville-calendar" } })
    .expect(401);

  assert.equal(response.body.error, "Unauthorized");
});

test("POST /api/availability requires Bella API key", async () => {
  const response = await request(app)
    .post("/api/availability")
    .send({
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      preferredDate: "2026-04-29"
    })
    .expect(401);

  assert.equal(response.body.error, "Unauthorized");
});

test("POST /api/booking requires Bella API key", async () => {
  const response = await request(app)
    .post("/api/booking")
    .send({
      callerName: "John Smith",
      callerPhone: "4435551234",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29T10:00:00"
    })
    .expect(401);

  assert.equal(response.body.error, "Unauthorized");
});

test("POST /api/availability rejects invalid preferredDate values", async () => {
  const response = await request(app)
    .post("/api/availability")
    .set("x-api-key", bellaApiKey)
    .send({
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      preferredDate: "04/29/2026"
    })
    .expect(200);

  assert.match(response.body.result, /valid appointment details/);
  assert.deepEqual(response.body.slots, []);
});

test("POST /api/availability rejects caller-supplied accountId", async () => {
  const response = await request(app)
    .post("/api/availability")
    .set("x-api-key", bellaApiKey)
    .send({
      accountId: "00000000-0000-0000-0000-000000000000",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      preferredDate: "2026-04-29"
    })
    .expect(200);

  assert.match(response.body.result, /valid appointment details/);
  assert.deepEqual(response.body.slots, []);
});

test("POST /api/booking rejects invalid appointmentStart values", async () => {
  const response = await request(app)
    .post("/api/booking")
    .set("x-api-key", bellaApiKey)
    .send({
      callerName: "John Smith",
      callerPhone: "4435551234",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29 10:00"
    })
    .expect(200);

  assert.match(response.body.result, /valid details/);
});

test("POST /api/booking rejects caller-supplied accountId", async () => {
  const response = await request(app)
    .post("/api/booking")
    .set("x-api-key", bellaApiKey)
    .send({
      accountId: "00000000-0000-0000-0000-000000000000",
      callerName: "John Smith",
      callerPhone: "4435551234",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29T10:00:00"
    })
    .expect(200);

  assert.match(response.body.result, /valid details/);
});

test("POST /api/booking rejects null callerEmail", async () => {
  const response = await request(app)
    .post("/api/booking")
    .set("x-api-key", bellaApiKey)
    .send({
      callerName: "John Smith",
      callerPhone: "4435551234",
      callerEmail: null,
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29T10:00:00"
    })
    .expect(200);

  assert.match(response.body.result, /valid details/);
});

test("POST /api/booking rejects invalid callerPhone values", async () => {
  const response = await request(app)
    .post("/api/booking")
    .set("x-api-key", bellaApiKey)
    .send({
      callerName: "John Smith",
      callerPhone: "12345",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29T10:00:00"
    })
    .expect(200);

  assert.match(response.body.result, /full ten-digit callback phone number/);
});

test("phone normalization converts local US numbers to E.164", () => {
  assert.equal(normalizeUsPhoneNumber("(443) 555-1234"), "+14435551234");
  assert.equal(normalizeUsPhoneNumber("1-443-555-1234"), "+14435551234");
  assert.equal(normalizeUsPhoneNumber("416-721-8008"), "+14167218008");
});

test("phone normalization rejects incomplete or malformed NANP numbers", () => {
  assert.throws(() => normalizeUsPhoneNumber("416-718-008"), /valid 10-digit/);
  assert.throws(() => normalizeUsPhoneNumber("+1416718008"), /valid 10-digit/);
  assert.throws(() => normalizeUsPhoneNumber("1416718008"), /valid 10-digit/);
});

test("slot generation respects capacity for overlapping appointments", () => {
  const date = DateTime.fromISO("2026-04-29", { zone: "Asia/Kolkata" });
  const busyRange = {
    start: DateTime.fromISO("2026-04-29T09:00:00", { zone: "Asia/Kolkata" }),
    end: DateTime.fromISO("2026-04-29T12:00:00", { zone: "Asia/Kolkata" })
  };

  const oneExistingJob = generateSlotsForDay({
    date,
    openTime: "09:00",
    closeTime: "17:00",
    durationMinutes: 180,
    bufferMinutes: 15,
    capacity: 2,
    busyRanges: [busyRange],
    now: DateTime.fromISO("2026-04-28T10:00:00", { zone: "Asia/Kolkata" })
  });

  const twoExistingJobs = generateSlotsForDay({
    date,
    openTime: "09:00",
    closeTime: "17:00",
    durationMinutes: 180,
    bufferMinutes: 15,
    capacity: 2,
    busyRanges: [busyRange, busyRange],
    now: DateTime.fromISO("2026-04-28T10:00:00", { zone: "Asia/Kolkata" })
  });

  assert.equal(oneExistingJob[0]?.toFormat("HH:mm"), "09:00");
  assert.notEqual(twoExistingJobs[0]?.toFormat("HH:mm"), "09:00");
});

test("slot generation respects same-day cutoff", () => {
  const slots = generateSlotsForDay({
    date: DateTime.fromISO("2026-04-29", { zone: "Asia/Kolkata" }),
    openTime: "09:00",
    closeTime: "17:00",
    durationMinutes: 90,
    bufferMinutes: 30,
    capacity: 2,
    busyRanges: [],
    sameDayCutoffTime: "14:00",
    now: DateTime.fromISO("2026-04-29T14:01:00", { zone: "Asia/Kolkata" })
  });

  assert.equal(slots.length, 0);
});

test("Google events convert to busy ranges in business timezone", () => {
  const ranges = googleEventsToBusyRanges(
    [
      {
        start: { dateTime: "2026-04-29T13:00:00Z" },
        end: { dateTime: "2026-04-29T15:00:00Z" }
      }
    ],
    DateTime.fromISO("2026-04-29", { zone: "Asia/Kolkata" })
  );

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0]?.start.toFormat("HH:mm"), "18:30");
  assert.equal(ranges[0]?.end.toFormat("HH:mm"), "20:30");
});

test("availability degrades gracefully when Google Calendar is unavailable", async () => {
  const response = await checkAvailability(
    {
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      preferredDate: "2026-04-29"
    },
    {
      loadAvailabilityConfig: async () => ({
        account: mockAccount,
        service: { id: "service-1", name: "Interior Deep Clean", slug: "interior_deep" },
        location: {
          id: "location-1",
          name: "Pikesville",
          slug: "pikesville",
          google_calendar_id: "location-calendar",
          capacity: 2,
          buffer_minutes: 15,
          same_day_cutoff_time: null
        },
        durationMinutes: 120
      }),
      loadHoursForDate: async () => ({ openTime: "09:00", closeTime: "17:00" }),
      fetchCalendarEvents: async () => {
        throw new AppError("Google Calendar is temporarily unavailable.", 503, "google_calendar_unavailable");
      }
    }
  );

  assert.equal(
    response.result,
    "I'm having trouble checking live calendar availability right now. Could I take your name and number and have a team member call you back?"
  );
  assert.deepEqual(response.slots, []);
});

test("booking handles race condition gracefully when a slot is taken mid-flow", async () => {
  const response = await confirmBookingWithDependencies(
    {
      callerName: "John Smith",
      callerPhone: "4435551234",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29T10:00:00"
    },
    {
      loadBookingConfig: async () => ({
        account: mockAccount,
        service: { id: "service-1", name: "Interior Deep Clean", slug: "interior_deep" },
        location: {
          id: "location-1",
          name: "Pikesville",
          slug: "pikesville",
          address: "1210 DeRisio Lane",
          google_calendar_id: "location-calendar",
          capacity: 2,
          buffer_minutes: 15,
          same_day_cutoff_time: null
        },
        durationMinutes: 120,
        priceCents: 24900
      }),
      assertSlotStillAvailable: async () => {
        throw new AppError("It looks like that slot was just taken. Let me find you the next available time.", 200);
      },
      createCalendarEvent: async () => {
        throw new Error("should not create calendar event");
      },
      deleteCalendarEvent: async () => undefined,
      createServiceSupabaseClient: () => {
        throw new Error("should not create supabase client");
      },
      sendSmsConfirmation: async () => false,
      sendEmailConfirmation: async () => false
    }
  );

  assert.equal(response.result, "It looks like that slot was just taken. Let me find you the next available time.");
});

test("booking degrades gracefully when Google Calendar write fails", async () => {
  const response = await confirmBookingWithDependencies(
    {
      callerName: "John Smith",
      callerPhone: "4435551234",
      service: "interior_deep",
      vehicleType: "suv",
      location: "pikesville",
      appointmentStart: "2026-04-29T10:00:00"
    },
    {
      loadBookingConfig: async () => ({
        account: mockAccount,
        service: { id: "service-1", name: "Interior Deep Clean", slug: "interior_deep" },
        location: {
          id: "location-1",
          name: "Pikesville",
          slug: "pikesville",
          address: "1210 DeRisio Lane",
          google_calendar_id: "location-calendar",
          capacity: 2,
          buffer_minutes: 15,
          same_day_cutoff_time: null
        },
        durationMinutes: 120,
        priceCents: 24900
      }),
      assertSlotStillAvailable: async () => DateTime.fromISO("2026-04-29T12:00:00", { zone: "Asia/Kolkata" }),
      createCalendarEvent: async () => {
        throw new AppError("Google Calendar is temporarily unavailable.", 503, "google_calendar_unavailable");
      },
      deleteCalendarEvent: async () => undefined,
      createServiceSupabaseClient: createNoExistingBookingSupabaseClient as never,
      sendSmsConfirmation: async () => false,
      sendEmailConfirmation: async () => false
    }
  );

  assert.equal(
    response.result,
    "I was unable to confirm that booking in the calendar right now. Could I take your details and have a team member confirm it with you?"
  );
});
