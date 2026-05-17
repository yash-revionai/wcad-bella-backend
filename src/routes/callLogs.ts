import { Router } from "express";
import { z } from "zod";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { resolveAccount } from "../services/accounts.js";
import {
  listRetellCalls,
  getRetellCall,
  calculateRetellDuration,
  determineRetellOutcome,
  type RetellCall
} from "../services/retell.js";

export const callLogsRouter = Router();

export interface CallLogEntry {
  callId: string;
  callerPhone: string | null;
  callerName: string | null;
  callStartedAt: string | null;
  callEndedAt: string | null;
  durationSeconds: number | null;
  disconnectionReason: string | null;
  outcome: "booked" | "abandoned" | "completed" | "error";
  summary: string | null;
  recordingUrl: string | null;
  bookingId: string | null;
}

const listCallLogsQuerySchema = z.object({
  pagination_key: z.string().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  accountId: z.string().uuid().optional()
});

const callParamsSchema = z.object({
  callId: z.string()
});

async function resolveCallerName(callId: string, bookingId: string | null): Promise<string | null> {
  const supabase = createServiceSupabaseClient();

  if (bookingId) {
    try {
      const { data } = await supabase.from("bookings").select("customer_name").eq("id", bookingId).single();
      if (data?.customer_name) return data.customer_name;
    } catch {
      // fall through to call_sessions lookup
    }
  }

  try {
    const { data } = await supabase.from("call_sessions").select("caller_name").eq("retell_call_id", callId).single();
    return data?.caller_name ?? null;
  } catch {
    return null;
  }
}

async function enrichCall(call: RetellCall): Promise<CallLogEntry> {
  const bookingId = call.call_analysis?.custom_analysis_data?.booking_id ?? null;
  const callerName = await resolveCallerName(call.call_id, bookingId || null);
  const duration = calculateRetellDuration(call);
  const outcome = determineRetellOutcome(call, Boolean(bookingId));

  return {
    callId: call.call_id,
    callerPhone: call.from_number,
    callerName,
    callStartedAt: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null,
    callEndedAt: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null,
    durationSeconds: duration,
    disconnectionReason: call.disconnection_reason,
    outcome,
    summary: call.call_analysis?.call_summary ?? null,
    recordingUrl: call.recording_url,
    bookingId: bookingId || null
  };
}

callLogsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listCallLogsQuerySchema.parse({
      pagination_key: req.query.pagination_key,
      pageSize: req.query.pageSize,
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });

    await resolveAccount(parsed.accountId);

    const callsResponse = await listRetellCalls({
      ...(parsed.pagination_key && { pagination_key: parsed.pagination_key }),
      limit: parsed.pageSize,
      sort_order: "descending"
    });

    const enrichedCalls: CallLogEntry[] = [];
    for (const call of callsResponse.calls) {
      enrichedCalls.push(await enrichCall(call));
    }

    res.json({
      calls: enrichedCalls,
      pagination_key: callsResponse.pagination_key ?? null
    });
  } catch (error) {
    next(error);
  }
});

callLogsRouter.get("/:callId", async (req, res, next) => {
  try {
    const { callId } = callParamsSchema.parse(req.params);
    const call = await getRetellCall(callId);
    const entry = await enrichCall(call);
    res.json(entry);
  } catch (error) {
    next(error);
  }
});
