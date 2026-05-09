import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { resolveAccount } from "../services/accounts.js";
import {
  listCalls,
  getCallRecordingUrl,
  extractCallerPhone,
  extractTwilioCallSid,
  fetchTwilioCallerPhone,
  calculateDuration,
  determineOutcome,
  UltravoxCall,
  CallLogEntry
} from "../services/ultravox.js";

export const callLogsRouter = Router();

const listCallLogsQuerySchema = z.object({
  cursor: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  accountId: z.string().uuid().optional()
});

const recordingParamsSchema = z.object({
  callId: z.string()
});

async function findBookingDuringCall(
  accountId: string,
  call: UltravoxCall
): Promise<{ id: string } | null> {
  const supabase = createServiceSupabaseClient();

  if (!call.joined || !call.ended) return null;

  const joinedAt = new Date(call.joined);
  const endedAt = new Date(call.ended);

  // Check for bookings created within the call timeframe (with 30s buffer after call ends)
  const bufferMs = 30000;
  const startTime = joinedAt.toISOString();
  const endTime = new Date(endedAt.getTime() + bufferMs).toISOString();

  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("account_id", accountId)
      .gte("created_at", startTime)
      .lte("created_at", endTime)
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.warn({ accountId, error }, "Failed to find booking for call");
      return null;
    }

    return data || null;
  } catch (error) {
    logger.warn({ accountId, error }, "Exception finding booking for call");
    return null;
  }
}

async function enrichCallWithBookingData(
  call: UltravoxCall,
  accountId: string,
  booking: { id: string } | null
): Promise<CallLogEntry> {
  const duration = calculateDuration(call);
  let callerPhone = extractCallerPhone(call);
  if (!callerPhone) {
    const sid = extractTwilioCallSid(call);
    if (sid) callerPhone = await fetchTwilioCallerPhone(sid);
  }
  const hasRecording = Boolean(call.recordingEnabled ?? false);

  // Try to find caller name if there's a booking
  const supabase = createServiceSupabaseClient();
  let callerName: string | null = null;

  if (booking) {
    try {
      const { data } = await supabase
        .from("bookings")
        .select("customer_name")
        .eq("id", booking.id)
        .single();

      callerName = data?.customer_name || null;
    } catch (error) {
      logger.warn({ bookingId: booking.id }, "Failed to fetch booking details");
    }
  }

  if (!callerName) {
    try {
      const { data } = await supabase
        .from("call_sessions")
        .select("caller_name")
        .eq("ultravox_call_id", call.callId)
        .single();

      callerName = data?.caller_name || null;
    } catch {
      // no name captured for this call
    }
  }

  const outcome = determineOutcome(call, Boolean(booking));

  return {
    callId: call.callId,
    callerPhone: callerPhone,
    callerName: callerName,
    callStartedAt: call.created,
    callEndedAt: call.ended || null,
    durationSeconds: duration,
    endReason: call.endReason || null,
    outcome,
    summary: call.summary || null,
    shortSummary: call.shortSummary || null,
    hasRecording,
    bookingId: booking?.id || null
  };
}

callLogsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listCallLogsQuerySchema.parse({
      cursor: req.query.cursor,
      pageSize: req.query.pageSize,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });

    const account = await resolveAccount(parsed.accountId);

    // Fetch calls from Ultravox
    const callsResponse = await listCalls({
      ...(parsed.cursor && { cursor: parsed.cursor }),
      pageSize: parsed.pageSize,
      ...(parsed.fromDate && { fromDate: parsed.fromDate }),
      ...(parsed.toDate && { toDate: parsed.toDate }),
      sort: "-created"
    });

    // Enrich each call with booking data
    const enrichedCalls: CallLogEntry[] = [];
    for (const call of callsResponse.results) {
      const booking = await findBookingDuringCall(account.id, call);
      const enriched = await enrichCallWithBookingData(call, account.id, booking);
      enrichedCalls.push(enriched);
    }

    res.json({
      calls: enrichedCalls,
      total: callsResponse.total,
      next: callsResponse.next || null,
      previous: callsResponse.previous || null
    });
  } catch (error) {
    next(error);
  }
});

callLogsRouter.get("/:callId/recording", async (req, res, next) => {
  try {
    const parsed = recordingParamsSchema.parse(req.params);

    const recordingUrl = await getCallRecordingUrl(parsed.callId);
    if (!recordingUrl) {
      throw new AppError("Recording not available for this call", 404);
    }

    res.json({ url: recordingUrl });
  } catch (error) {
    next(error);
  }
});
