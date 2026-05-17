import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const RETELL_API_BASE = "https://api.retellai.com/v2";

export interface RetellCall {
  call_id: string;
  call_type: "phone_call" | "web_call";
  call_status: "registered" | "not_connected" | "ongoing" | "ended" | "error";
  agent_id: string;
  from_number: string | null;
  to_number: string | null;
  direction: "inbound" | "outbound";
  start_timestamp: number | null;
  end_timestamp: number | null;
  duration_ms: number | null;
  transcript: string | null;
  disconnection_reason: string | null;
  recording_url: string | null;
  call_analysis: {
    call_summary: string | null;
    call_successful: boolean | null;
    user_sentiment: "Positive" | "Negative" | "Neutral" | "Unknown" | null;
    custom_analysis_data: {
      booking_id?: string;
      caller_name?: string;
      call_outcome?: string;
    } | null;
  } | null;
  metadata: Record<string, unknown> | null;
}

export interface RetellCallList {
  calls: RetellCall[];
  pagination_key?: string;
}

async function fetchFromRetell<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!env.RETELL_API_KEY) {
    throw new AppError("RETELL_API_KEY not configured", 503);
  }

  const url = `${RETELL_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${env.RETELL_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, "Retell API error");
    throw new AppError(`Retell API error: ${response.status}`, 503);
  }

  return response.json() as Promise<T>;
}

export async function listRetellCalls(params?: {
  pagination_key?: string;
  limit?: number;
  filter_criteria?: Record<string, unknown>;
  sort_order?: "ascending" | "descending";
}): Promise<RetellCallList> {
  return fetchFromRetell<RetellCallList>("/list-calls", {
    method: "POST",
    body: JSON.stringify(params ?? {})
  });
}

export async function getRetellCall(callId: string): Promise<RetellCall> {
  return fetchFromRetell<RetellCall>(`/get-call/${callId}`);
}

export function calculateRetellDuration(call: RetellCall): number | null {
  if (call.duration_ms == null) return null;
  return Math.floor(call.duration_ms / 1000);
}

export function determineRetellOutcome(
  call: RetellCall,
  bookingCreatedDuringCall: boolean
): "booked" | "abandoned" | "completed" | "error" {
  if (bookingCreatedDuringCall) return "booked";
  if (call.disconnection_reason?.includes("error")) return "error";
  if (call.disconnection_reason === "user_hangup" && (call.duration_ms ?? 0) < 30_000) return "abandoned";
  return "completed";
}
