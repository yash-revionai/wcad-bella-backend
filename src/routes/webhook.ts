import crypto from "node:crypto";
import express, { Router } from "express";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import { type RetellCall, calculateRetellDuration, determineRetellOutcome } from "../services/retell.js";
import { sendOwnerCallNotification } from "../services/notifications.js";

export const webhookRouter = Router();

function verifyRetellSignature(rawBody: Buffer, signatureHeader: string, apiKey: string): boolean {
  const match = signatureHeader.match(/v=(\d+),d=(.+)/);
  if (!match) return false;
  const [, timestamp, receivedDigest] = match as [string, string, string];

  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false;

  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(rawBody.toString() + timestamp)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(receivedDigest), Buffer.from(expected));
  } catch {
    return false;
  }
}

webhookRouter.post("/retell", express.raw({ type: "application/json" }), async (req, res) => {
  res.sendStatus(200);

  const rawBody = req.body as Buffer;
  const sigHeader = req.headers["x-retell-signature"] as string | undefined;

  if (!sigHeader) {
    logger.warn({ headers: req.headers }, "Retell webhook: missing X-Retell-Signature header");
    return;
  }

  if (!env.RETELL_API_KEY) {
    logger.error("Retell webhook: RETELL_API_KEY not configured, cannot verify signature");
    return;
  }

  if (!verifyRetellSignature(rawBody, sigHeader, env.RETELL_API_KEY)) {
    logger.warn({ sigHeader }, "Retell webhook: signature verification failed");
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    logger.warn("Retell webhook: invalid JSON body");
    return;
  }

  const p = payload as Record<string, unknown>;
  const event = p["event"] as string | undefined;
  const call = p["call"] as RetellCall | undefined;

  if (!call?.call_id) {
    logger.warn({ payload }, "Retell webhook: could not extract call object");
    return;
  }

  if (event === "call_ended") {
    // call_analysis is NOT present on call_ended — just log
    logger.info({ callId: call.call_id, disconnection_reason: call.disconnection_reason }, "Retell call ended");
    return;
  }

  if (event === "call_analyzed") {
    try {
      await handleCallAnalyzed(call);
    } catch (error) {
      logger.error({ error, callId: call.call_id }, "Retell webhook: error processing call_analyzed");
    }
    return;
  }

  logger.info({ event }, "Retell webhook: ignoring event");
});

async function handleCallAnalyzed(call: RetellCall) {
  const supabase = createServiceSupabaseClient();

  const callerPhone = call.from_number;

  // Caller name: session table first, then post-call analysis extraction
  let callerName: string | null = null;
  try {
    const { data } = await supabase
      .from("call_sessions")
      .select("caller_name")
      .eq("retell_call_id", call.call_id)
      .maybeSingle();
    callerName = data?.caller_name ?? null;
  } catch {
    // no session captured
  }

  if (!callerName) {
    callerName = call.call_analysis?.custom_analysis_data?.caller_name ?? null;
  }

  type BookingRow = {
    id: string;
    customer_name: string;
    appointment_start: string;
    services: { name: string } | null;
    locations: { name: string } | null;
  };

  let bookingData: BookingRow | null = null;

  // Primary: booking_id extracted by post-call analysis from transcript
  const bookingId = call.call_analysis?.custom_analysis_data?.booking_id;
  if (bookingId) {
    try {
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, appointment_start, services ( name ), locations ( name )")
        .eq("id", bookingId)
        .maybeSingle();
      bookingData = data as BookingRow | null;
    } catch {
      // booking not found by id
    }
  }

  // Fallback: timestamp-based lookup
  if (!bookingData && call.start_timestamp && call.end_timestamp) {
    const startTime = new Date(call.start_timestamp).toISOString();
    const endTime = new Date(call.end_timestamp + 30_000).toISOString();

    try {
      const { data } = await supabase
        .from("bookings")
        .select("id, customer_name, appointment_start, services ( name ), locations ( name )")
        .gte("created_at", startTime)
        .lte("created_at", endTime)
        .limit(1)
        .maybeSingle();
      bookingData = data as BookingRow | null;
    } catch {
      // no booking found
    }
  }

  const duration = calculateRetellDuration(call);
  const outcome = determineRetellOutcome(call, Boolean(bookingData));

  await sendOwnerCallNotification({
    callerPhone,
    callerName,
    durationSeconds: duration,
    outcome,
    shortSummary: call.call_analysis?.call_summary ?? null,
    booking: bookingData
      ? {
          serviceName: bookingData.services?.name ?? "Detail Service",
          customerName: bookingData.customer_name,
          locationName: bookingData.locations?.name ?? "Location",
          appointmentStartIso: bookingData.appointment_start
        }
      : null
  });

  logger.info({ callId: call.call_id, outcome }, "Owner call notification sent");
}
