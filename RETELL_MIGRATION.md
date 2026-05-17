# Bella Backend: Ultravox → Retell AI Migration Plan

## Context

Quintin reported three critical failures with the current Ultravox-based system:
1. No call-end notifications sent (webhook never deployed/committed)
2. Calls hanging up mid-conversation
3. Calendar integration not functioning as expected

Decision: Migrate to **Retell AI** (GPT-5.1 + ElevenLabs, Conversation Flow agent) for better reliability, naturalness, and production-tested webhook delivery.

This backend handles all business logic. The Retell agent (prompt, conversation flow, tool definitions) is configured in the Retell dashboard — not in this codebase.

---

## What Stays Unchanged

- `src/services/availability.ts` — slot generation + Google Calendar logic
- `src/services/booking.ts` — booking + idempotency + confirmations
- `src/services/calendar.ts` — Google Calendar API calls
- `src/services/notifications.ts` — email/SMS delivery
- `src/services/token.ts`, `src/services/accounts.ts`
- All admin routes: auth, google, health, time
- Database schema (bookings, locations, services, pricing, etc.)
- Google Calendar 3-calendar setup (pikesville, towson, mobile + overlay)
- Twilio SMS, Resend email, Supabase, encryption

---

## File Change Summary

```
CREATE:   src/services/retell.ts
CREATE:   database/migrations/001_retell_migration.sql

DELETE:   src/services/ultravox.ts

REWRITE:  src/routes/webhook.ts

UPDATE:   src/lib/env.ts           (swap Ultravox vars → RETELL_API_KEY)
          src/routes/callLogs.ts   (Retell API instead of Ultravox API)
          src/routes/callerInfo.ts (ultravox_call_id → retell_call_id)
          src/app.ts               (CORS origin update)

MINOR:    src/routes/availability.ts   (remove X-Ultravox-Agent-Reaction header + agentReaction field)
          src/routes/booking.ts
          src/routes/transfer.ts
          src/routes/callbackRequest.ts
```

---

## Phase 1 — Foundation (Code Cleanup + New Retell Service)

### 1.1 Update `src/lib/env.ts`

Remove:
```
ULTRAVOX_API_KEY
ULTRAVOX_WEBHOOK_SECRET
```

Add:
```
RETELL_API_KEY   // Used for API calls AND webhook signature verification (same key)
```

### 1.2 Delete `src/services/ultravox.ts`

No longer needed. All Ultravox-specific types, API calls, and phone extraction logic removed.

### 1.3 Create `src/services/retell.ts`

Retell API base: `https://api.retellai.com/v2`
Auth header: `Authorization: Bearer ${env.RETELL_API_KEY}`

```typescript
export interface RetellCall {
  call_id: string;
  call_type: "phone_call" | "web_call";
  call_status: "registered" | "not_connected" | "ongoing" | "ended" | "error";
  agent_id: string;
  from_number: string | null;        // E.164 caller phone — use directly, no Twilio lookup needed
  to_number: string | null;
  direction: "inbound" | "outbound";
  start_timestamp: number | null;    // Unix ms
  end_timestamp: number | null;      // Unix ms
  duration_ms: number | null;
  transcript: string | null;
  disconnection_reason: string | null;
  recording_url: string | null;
  call_analysis: {
    call_summary: string | null;
    call_successful: boolean | null;
    user_sentiment: "Positive" | "Negative" | "Neutral" | "Unknown" | null;
    custom_analysis_data: {
      booking_id?: string;     // extracted via post-call analysis
      caller_name?: string;    // extracted via post-call analysis
      call_outcome?: string;   // booked|transferred|callback_requested|inquiry_only|abandoned
    } | null;
  } | null;
  metadata: Record<string, unknown> | null;
}

// Functions:
listRetellCalls(params?)    → GET /v2/calls
getRetellCall(callId)       → GET /v2/calls/{call_id}
calculateRetellDuration(call) → call.duration_ms / 1000
determineRetellOutcome(call, bookingCreatedDuringCall) → "booked"|"abandoned"|"completed"|"error"
```

Outcome logic:
- `booked` → bookingCreatedDuringCall is true
- `abandoned` → disconnection_reason is `user_hangup` with no booking + short duration
- `error` → disconnection_reason contains `error`
- `completed` → everything else

### 1.4 Database Migration

Create `database/migrations/001_retell_migration.sql`:

```sql
ALTER TABLE call_sessions
  RENAME COLUMN ultravox_call_id TO retell_call_id;

DROP INDEX IF EXISTS call_sessions_ultravox_call_id_idx;
CREATE INDEX IF NOT EXISTS call_sessions_retell_call_id_idx ON call_sessions(retell_call_id);
```

Run in Supabase SQL editor **before deploying**.

---

## Phase 2 — Webhook Rewrite

### Replace `src/routes/webhook.ts`

**Path:** `POST /api/webhooks/retell` (was `/api/webhooks/ultravox`)

**Retell Signature Verification:**

Header format: `X-Retell-Signature: v={timestamp_ms},d={hex_digest}`

```typescript
function verifyRetellSignature(rawBody: Buffer, signatureHeader: string, apiKey: string): boolean {
  const match = signatureHeader.match(/v=(\d+),d=(.+)/);
  if (!match) return false;
  const [, timestamp, receivedDigest] = match;

  // Reject if > 5 minutes old (replay attack prevention)
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false;

  // HMAC-SHA256(rawBodyString + timestamp, apiKey)
  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(rawBody.toString() + timestamp)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(receivedDigest), Buffer.from(expected));
}
```

**Retell Webhook Payload (`call_ended`):**
```json
{
  "event": "call_ended",
  "call": {
    "call_id": "string",
    "from_number": "+14435551234",
    "to_number": "+18623100216",
    "direction": "inbound",
    "start_timestamp": 1234567890000,
    "end_timestamp": 1234567890000,
    "duration_ms": 180000,
    "transcript": "string",
    "disconnection_reason": "user_hangup",
    "recording_url": "https://...",
    "call_analysis": {
      "call_summary": "string",
      "call_successful": true,
      "user_sentiment": "Positive",
      "custom_analysis_data": {
        "booking_id": "uuid-or-empty",
        "caller_name": "John Smith",
        "call_outcome": "booked"
      }
    }
  }
}
```

**Handler logic for `call_ended`:**
1. Respond 200 immediately (before any processing)
2. Verify `X-Retell-Signature` using `env.RETELL_API_KEY`
3. Ignore events that are not `call_ended`
4. `callerPhone = call.from_number` (already E.164 — no Twilio lookup needed)
5. `callerName` = look up `call_sessions` by `retell_call_id = call.call_id`, fallback to `call_analysis.custom_analysis_data.caller_name`
6. Find booking:
   - Primary: query `bookings` where `id = call_analysis.custom_analysis_data.booking_id` (if present)
   - Fallback: query `bookings` where `created_at BETWEEN start_timestamp AND end_timestamp + 30s`
7. Duration: `call.duration_ms / 1000`
8. Outcome: `determineRetellOutcome(call, Boolean(bookingData))`
9. Call `sendOwnerCallNotification()` (unchanged)

---

## Phase 3 — Tool Endpoint Cleanup

### Remove Ultravox Headers from All Bella-Facing Endpoints

In these files, remove:
- `res.set("X-Ultravox-Agent-Reaction", "speaks")` (and any variant)
- `agentReaction` field from all response JSON objects

Files: `availability.ts`, `booking.ts`, `transfer.ts`, `callbackRequest.ts`, `callerInfo.ts`

Retell does not use this header. Responses are plain JSON only.

### Update `src/routes/callerInfo.ts`

Change Supabase upsert field: `ultravox_call_id` → `retell_call_id`

Everything else stays the same — Bella still calls this tool mid-conversation to save the caller's name.

### Transfer Endpoint

`src/routes/transfer.ts` stays functionally the same — returns a phone number.
Remove `agentReaction: "transfer-call"` from response.
The Retell agent uses the returned `transferTo` number to initiate a warm transfer via Retell's built-in transfer capability.

---

## Phase 4 — Call Logs Rewrite

### Rewrite `src/routes/callLogs.ts`

Replace all Ultravox API calls with Retell API calls from `src/services/retell.ts`:

- `listRetellCalls(params)` for the list endpoint
- `getRetellCall(callId)` for individual call lookup
- `call.recording_url` is directly on the call object — no separate recording API call
- `call.from_number` is the caller phone — no Twilio fallback needed
- Caller name: look up from `call_sessions` by `retell_call_id`
- Duration: `call.duration_ms / 1000`
- Summary: `call.call_analysis.call_summary`
- Outcome: `determineRetellOutcome(call, Boolean(bookingId))`

---

## Phase 5 — App Config Update

### Update `src/app.ts`

Remove `api.ultravox.ai` from CORS allowed origins.
Webhook path stays at `/api/webhooks` — internal handler now serves `/retell`.

---

## Phase 6 — Retell Dashboard Configuration (Manual)

Done in the Retell dashboard, not in code.

### Agent Setup
- **Type:** Conversation Flow
- **LLM:** GPT-5.1
- **TTS:** ElevenLabs — audition female American voices, pick warmest/most professional
- **Interruption sensitivity:** 0.65
- **End call after silence:** 15,000ms
- **Webhook URL:** `https://[railway-url]/api/webhooks/retell`
- **Webhook events:** `call_ended`, `call_analyzed`

### Register These 5 HTTP Tools

All tools: POST method, header `x-api-key: {BELLA_API_KEY}`

| Tool Name | URL | Purpose |
|---|---|---|
| `check_availability` | `/api/availability` | Check open slots |
| `confirm_booking` | `/api/booking` | Book appointment |
| `save_caller_info` | `/api/caller-info` | Store caller name mid-call |
| `request_transfer` | `/api/transfer` | Get transfer phone number |
| `save_callback` | `/api/callback-request` | Log callback request |

**CRITICAL:** Enable "Speak After Execution" on ALL 5 tools.
Without this, Bella silently freezes after every tool call (confirmed Retell production bug).

### Post-Call Analysis Fields

Configure in Retell agent → Analysis:

```json
[
  { "name": "caller_name", "type": "string", "description": "Full name the caller provided" },
  { "name": "booking_id", "type": "string", "description": "Booking ID from confirm_booking tool result, or empty" },
  { "name": "call_outcome", "type": "enum", "values": ["booked","transferred","callback_requested","inquiry_only","abandoned"], "description": "Outcome of the call" }
]
```

### Conversation Flow Node Structure

```
[Greeting] → save_caller_info → detect intent
    ↓
[Branch]
    ├─ Booking → check_availability → present slots → confirm_booking → [Closing]
    ├─ Transfer → request_transfer → warm transfer → [End]
    ├─ Callback → save_callback → [Closing]
    └─ Inquiry → answer → [Closing]
[Closing] → confirm details, goodbye
```

### Twilio Number Import

1. In Twilio: create Elastic SIP Trunk, set termination URI to `sip://soml.us.retellai.com:5060`
2. In Retell: Phone Numbers → Import → provide Twilio number `+18623100216` and SIP trunk credentials
3. Bind the Bella agent to this number for inbound calls

---

## Phase 7 — Deployment & Verification

### Railway Environment Variables

Add:
```
RETELL_API_KEY=key_...
OWNER_NOTIFICATION_EMAIL=<Quintin's email>
```

Remove:
```
ULTRAVOX_API_KEY
ULTRAVOX_WEBHOOK_SECRET
```

### Verification Checklist

1. `npm run build` — zero TypeScript errors
2. `npm test` — all 34 tests pass (no business logic changed)
3. Run DB migration in Supabase SQL editor
4. Deploy to Railway, confirm `/api/health` returns 200
5. Make test call → verify:
   - [ ] Bella answers and greets naturally
   - [ ] Availability check returns correct slots
   - [ ] Booking creates Google Calendar event
   - [ ] Customer receives SMS confirmation
   - [ ] Owner receives email notification after call ends
   - [ ] `call_sessions` table has `retell_call_id` entry after call
6. Check Railway logs for webhook signature errors
7. Verify recording URL accessible from call logs admin endpoint

---

## Google Calendar: No Changes Required

The 3-calendar setup (Pikesville + Towson + Mobile + main PocketSuite overlay) is handled entirely in `src/services/calendar.ts` and `src/services/availability.ts`.

Retell calls `POST /api/availability` → backend runs existing Google Calendar logic unchanged. Calendar integration is invisible to the voice platform.

---

## New Environment Variables

```bash
# ADD TO RAILWAY
RETELL_API_KEY=key_...        # From Retell dashboard → API Keys

# ALREADY NEEDED (verify these are set)
OWNER_NOTIFICATION_EMAIL=...  # Where Quintin gets call notifications
BELLA_API_KEY=...             # Used as x-api-key in Retell tool headers

# REMOVE FROM RAILWAY
# ULTRAVOX_API_KEY
# ULTRAVOX_WEBHOOK_SECRET
```
