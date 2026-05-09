import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const ULTRAVOX_API_BASE = "https://api.ultravox.ai/api";

export interface UltravoxCall {
  callId: string;
  created: string;
  joined: string | null;
  ended: string | null;
  endReason?: "unjoined" | "hangup" | "agent_hangup" | "timeout" | "connection_error" | "system_error";
  billedDuration: string | null;
  billingStatus?: string;
  agentId: string | null;
  summary: string | null;
  shortSummary: string | null;
  recordingEnabled?: boolean;
  metadata?: Record<string, unknown>;
  sipDetails?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UltravoxCallList {
  results: UltravoxCall[];
  total: number;
  next?: string;
  previous?: string;
}

export interface CallRecordingResponse {
  callId: string;
  recordingUrl: string;
}

export interface CallLogEntry {
  callId: string;
  callerPhone: string | null;
  callerName: string | null;
  callStartedAt: string;
  callEndedAt: string | null;
  durationSeconds: number | null;
  endReason: string | null;
  outcome: "booked" | "abandoned" | "completed" | "error";
  summary: string | null;
  shortSummary: string | null;
  hasRecording: boolean;
  bookingId: string | null;
}

async function fetchFromUltravox<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!env.ULTRAVOX_API_KEY) {
    throw new AppError("ULTRAVOX_API_KEY not configured", 503);
  }

  const url = `${ULTRAVOX_API_BASE}${endpoint}`;
  const headers = {
    ...options.headers,
    "X-API-Key": env.ULTRAVOX_API_KEY,
    "Content-Type": "application/json"
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, "Ultravox API error");
    throw new AppError(`Ultravox API error: ${response.status}`, 503);
  }

  return response.json() as Promise<T>;
}

export async function listCalls(params?: {
  cursor?: string;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  sort?: string;
}): Promise<UltravoxCallList> {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.fromDate) searchParams.set("fromDate", params.fromDate);
  if (params?.toDate) searchParams.set("toDate", params.toDate);
  if (params?.sort) searchParams.set("sort", params.sort);

  const query = searchParams.toString();
  const endpoint = `/calls${query ? `?${query}` : ""}`;

  return fetchFromUltravox<UltravoxCallList>(endpoint);
}

export async function getCall(callId: string): Promise<UltravoxCall> {
  return fetchFromUltravox<UltravoxCall>(`/calls/${callId}`);
}

export async function getCallRecordingUrl(callId: string): Promise<string | null> {
  try {
    const response = await fetchFromUltravox<{ recordingUrl: string }>(
      `/calls/${callId}/recording`
    );
    return response.recordingUrl || null;
  } catch (error) {
    logger.warn({ callId }, "Failed to fetch recording URL");
    return null;
  }
}

export function extractCallerPhone(call: UltravoxCall): string | null {
  if (call.metadata?.callerPhone) {
    return String(call.metadata.callerPhone);
  }

  if (call.sipDetails?.["P-Asserted-Identity"]) {
    const match = String(call.sipDetails["P-Asserted-Identity"]).match(/sip:(\+?[\d]+)@/);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function extractTwilioCallSid(call: UltravoxCall): string | null {
  const sid = call.metadata?.["ultravox.twilio.call_sid"];
  return sid ? String(sid) : null;
}

export async function fetchTwilioCallerPhone(callSid: string): Promise<string | null> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`;
    const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const response = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });
    if (!response.ok) return null;
    const data = await response.json() as { from?: string };
    return data.from ?? null;
  } catch {
    return null;
  }
}

export function calculateDuration(call: UltravoxCall): number | null {
  if (!call.joined || !call.ended) return null;

  const joinedMs = new Date(call.joined).getTime();
  const endedMs = new Date(call.ended).getTime();

  const durationMs = endedMs - joinedMs;
  return durationMs > 0 ? Math.floor(durationMs / 1000) : null;
}

export function determineOutcome(
  call: UltravoxCall,
  bookingCreatedDuringCall: boolean
): "booked" | "abandoned" | "completed" | "error" {
  if (bookingCreatedDuringCall) return "booked";

  if (call.endReason === "unjoined" || !call.joined) return "abandoned";
  if (call.endReason === "connection_error" || call.endReason === "system_error") return "error";

  return "completed";
}
