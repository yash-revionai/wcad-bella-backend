# WCAD Bella — AI Receptionist & Booking System
## CLAUDE.md — Complete Project Blueprint & Development Guide

---

## Project Overview

This is the backend system and admin dashboard powering **Bella**, the AI voice receptionist for **World Class Auto Detail** (WCAD) — a professional auto detailing company in Baltimore, Maryland with two physical shops (Pikesville and Towson) and two mobile units.

Bella is a voice agent built on the **Ultravox** platform. She handles inbound phone calls 24/7, answers questions about services and pricing, checks real-time availability across all three service locations, and confirms appointments on the spot — without needing a staff callback for scheduling.

This system is the **backend infrastructure Bella calls during live phone conversations**. It must be fast, reliable, and deterministic. A slow or failed API response during a call means Bella goes silent mid-conversation. That is unacceptable.

---

## The Problem Being Solved

World Class Auto Detail currently handles all bookings manually. Staff answer phones, check availability, and call customers back to confirm. This creates three critical problems:

1. **Missed same-day revenue** — Quintin stated same-day bookings are a major revenue source. If no one answers, the booking is lost.
2. **No 24/7 coverage** — Calls outside business hours go unanswered with no capture mechanism.
3. **Multi-location confusion** — Two shops plus mobile units with floating staff make availability management complex and error-prone.

Bella solves all three. This system makes Bella's booking capability real.

---

## Target Users

**Bella (Ultravox voice agent)** — The primary API consumer. Calls `checkAvailability` and `confirmBooking` during live phone calls. Latency must be under 2 seconds per API response or the voice conversation degrades.

**Quintin Moody (business owner)** — Uses the admin dashboard to view upcoming bookings, manage location hours, block days off, and adjust same-day cutoffs. Non-technical user. The UI must be simple and self-explanatory.

**You (developer)** — Maintains the system, updates config when Quintin's needs change, monitors errors.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend API | Node.js + Express + TypeScript | Fast, lightweight, type-safe enough for scheduling, pricing, and external API payloads |
| Database | Supabase (PostgreSQL) | Managed Postgres, built-in auth, REST API, easy dashboard, free tier is enough for MVP |
| Admin Frontend | Next.js + Tailwind CSS + TypeScript | Strong fit for a mobile-first admin dashboard and installable PWA |
| Calendar Integration | Google Calendar API v3 | Quintin already uses it, OAuth 2.0 for secure access |
| Email Confirmations | Resend | Free up to 3,000/month, simple API, reliable delivery |
| SMS Confirmations | Twilio | Industry standard, reliable delivery, built-in opt-out handling; account setup and carrier fees must be expected |
| Backend Hosting | Railway | $5/month always-on, no cold starts, auto-deploy from GitHub |
| Admin Hosting | Vercel Pro or Railway | Vercel Hobby is for non-commercial personal use only; production WCAD dashboard must use Vercel Pro or Railway |
| Version Control | GitHub | Required for Railway/Vercel auto-deploy and project history |
| Cloud Dev Environment | GitHub Codespaces | All compute runs in cloud, local VS Code connects via extension |

---

## System Architecture

```
INBOUND PHONE CALL
        │
        ▼
   ULTRAVOX (Bella)
        │
        ├── checkAvailability ──────────────────────────────────────────┐
        │                                                                │
        ├── confirmBooking ───────────────────────────────────────────┐ │
        │                                                              │ │
        └── transferToStaff ─────────────────── Telephony Provider    │ │
                                                                       │ │
                                        ┌──────────────────────────────┘ │
                                        │                                 │
                                        ▼                                 ▼
                              NODE.JS BACKEND API (Railway)
                                        │
                    ┌───────────────────┼────────────────────┐
                    │                   │                     │
                    ▼                   ▼                     ▼
             SUPABASE DB         GOOGLE CALENDAR         RESEND + TWILIO
          (bookings, tokens,    (3 location calendars    (email + SMS
           config, accounts)    + main busy overlay)      confirmations)
                    │
                    ▼
             ADMIN DASHBOARD (Vercel Pro or Railway)
             (Quintin's UI)
```

---

## Google Calendar Architecture

This is the most important architectural decision in the system. Understand it fully before writing any calendar code.

**Quintin has one Gmail account: worldclassautodetail@gmail.com**

Inside that account there will be FOUR calendars:

| Calendar Name | Purpose | Read or Write |
|---|---|---|
| Main / existing calendar | PocketSuite syncs here. Shows existing jobs and personal blocks. | Read-only — used as busy overlay |
| World Class - Pikesville | Bella writes new Pikesville bookings here | Read + Write |
| World Class - Towson | Bella writes new Towson bookings here | Read + Write |
| World Class - Mobile | Bella writes new Mobile bookings here | Read + Write |

**How availability checking works:**

When Bella calls `checkAvailability` for Pikesville on a given day:
1. Query the Pikesville calendar for existing events — these are confirmed bookings
2. Query the main calendar for busy events on the same day — these are PocketSuite jobs or manual blocks
3. Combine both into a list of occupied time ranges
4. Apply the duration for the requested service + vehicle type from the config
5. Apply the buffer time (15 minutes for shops, 30 for mobile)
6. Apply capacity (2 simultaneous jobs per location)
7. Apply same-day cutoff if applicable (mobile only, 2pm)
8. Return the remaining open slots

**Why this matters:** PocketSuite has no API. Its events sync one-way into the main Google Calendar. By reading the main calendar as a busy overlay, Bella automatically respects PocketSuite bookings without any direct PocketSuite integration. This is the entire workaround.

---

## Database Schema

### Table: accounts
Stores one row per business using the system. Built for multi-tenancy from day one even though Quintin is the only current client.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_primary TEXT,
  phone_secondary TEXT,
  google_refresh_token_encrypted TEXT,
  google_access_token_encrypted TEXT,
  google_token_expiry TIMESTAMPTZ,
  google_main_calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Token storage rule:** refresh tokens and cached access tokens must be encrypted before storage. The access token is optional and short-lived; it exists only as a latency optimization so Bella is not forced to wait for a Google token refresh on every call.

### Table: locations
One row per bookable location per account.

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  google_calendar_id TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  same_day_cutoff_time TIME,
  is_active BOOLEAN DEFAULT TRUE,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);
```

**Calendar mapping rule:** `google_calendar_id` starts as null during seed/setup. After Quintin connects Google Calendar, the admin dashboard must list calendars from the authorized Google account and let him map:
- Main / PocketSuite calendar → `accounts.google_main_calendar_id`
- World Class - Pikesville → Pikesville `locations.google_calendar_id`
- World Class - Towson → Towson `locations.google_calendar_id`
- World Class - Mobile → Mobile `locations.google_calendar_id`

Availability and booking endpoints must fail gracefully with a Bella-speakable setup message if required calendar mappings are missing.

### Table: location_hours
Operating hours per location per day of week. Allows different hours per day.

```sql
CREATE TABLE location_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  UNIQUE(location_id, day_of_week)
);
```

### Table: location_overrides
One-off day closures or hour changes — e.g., Towson closed this Thursday.

```sql
CREATE TABLE location_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, override_date)
);
```

### Table: services
Service catalogue per account.

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  requires_staff_consult BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, slug)
);
```

### Table: service_durations
Duration matrix — one row per service + vehicle type combination.

```sql
CREATE TABLE service_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'commercial')),
  duration_minutes INTEGER NOT NULL,
  UNIQUE(service_id, vehicle_type)
);
```

### Table: service_locations
Which services are available at which locations.

```sql
CREATE TABLE service_locations (
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, location_id)
);
```

### Table: pricing
Pricing matrix — one row per service + vehicle type combination.

```sql
CREATE TABLE pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'commercial')),
  price_cents INTEGER NOT NULL,
  UNIQUE(service_id, vehicle_type)
);
```

### Table: bookings
Every appointment Bella confirms.

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  service_id UUID REFERENCES services(id),
  vehicle_type TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  appointment_start TIMESTAMPTZ NOT NULL,
  appointment_end TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  google_event_id TEXT,
  notes TEXT,
  price_cents INTEGER,
  confirmation_sms_sent BOOLEAN DEFAULT FALSE,
  confirmation_email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: admin_users
Login credentials for the admin dashboard.

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'staff', 'developer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Seed Data for Quintin's Account

When the database is set up, seed it with this exact data. This is derived from the client intake forms.

### Locations

```javascript
const locations = [
  {
    name: 'World Class - Pikesville',
    slug: 'pikesville',
    address: '1210 DeRisio Lane, Pikesville, MD 21208',
    capacity: 2,
    buffer_minutes: 15,
    same_day_cutoff_time: null,
    hours: {
      0: { is_closed: true },                              // Sunday
      1: { open: '09:00', close: '17:00' },               // Monday
      2: { open: '09:00', close: '17:00' },               // Tuesday
      3: { open: '09:00', close: '17:00' },               // Wednesday
      4: { open: '09:00', close: '17:00' },               // Thursday
      5: { open: '09:00', close: '17:00' },               // Friday
      6: { open: '09:00', close: '17:00' },               // Saturday
    }
  },
  {
    name: 'World Class - Towson',
    slug: 'towson',
    address: '1 West Pennsylvania Ave, Towson Commons Garage Level 1A, Towson, MD 21204',
    capacity: 2,
    buffer_minutes: 15,
    same_day_cutoff_time: null,
    hours: {
      0: { is_closed: true },
      1: { open: '09:00', close: '17:00' },
      2: { open: '09:00', close: '17:00' },
      3: { open: '09:00', close: '17:00' },
      4: { open: '09:00', close: '17:00' },
      5: { open: '09:00', close: '17:00' },
      6: { open: '09:00', close: '17:00' },
    }
  },
  {
    name: 'World Class - Mobile',
    slug: 'mobile',
    address: 'Mobile — serves 25-mile radius from Pikesville',
    capacity: 2,
    buffer_minutes: 30,
    same_day_cutoff_time: '14:00',
    hours: {
      0: { is_closed: true },
      1: { open: '09:00', close: '17:00' },
      2: { open: '09:00', close: '17:00' },
      3: { open: '09:00', close: '17:00' },
      4: { open: '09:00', close: '17:00' },
      5: { open: '09:00', close: '17:00' },
      6: { open: '09:00', close: '17:00' },
    }
  }
]
```

### Service Duration Matrix (minutes — using upper end of ranges)

```javascript
const durations = {
  express_detail:    { sedan: 90,  suv: 120, truck: 150, commercial: 180 },
  exterior_wax:      { sedan: 150, suv: 180, truck: 180, commercial: 210 },
  interior_deep:     { sedan: 150, suv: 180, truck: 180, commercial: 210 },
  complete_detail:   { sedan: 210, suv: 240, truck: 270, commercial: 300 },
  paint_correction:  { sedan: 300, suv: 300, truck: 420, commercial: 420 },
  ceramic_coating:   { sedan: 480, suv: 480, truck: 480, commercial: 480 },
}
```

### Pricing (in cents to avoid floating point)

```javascript
const pricing = {
  express_detail:  { sedan: 9900,  suv: 10900, truck: 12900, commercial: 17500 },
  exterior_wax:    { sedan: 18500, suv: 22500, truck: 27500, commercial: 37500 },
  interior_deep:   { sedan: 18500, suv: 22500, truck: 27500, commercial: 30500 },
  complete_detail: { sedan: 30000, suv: 35000, truck: 39500, commercial: 47500 },
}
```

### Services Available Per Location

```javascript
const serviceLocations = {
  pikesville: ['express_detail', 'exterior_wax', 'interior_deep', 'complete_detail', 'paint_correction', 'ceramic_coating', 'alacarte'],
  towson:     ['express_detail', 'exterior_wax', 'interior_deep', 'complete_detail', 'paint_correction', 'ceramic_coating', 'alacarte'],
  mobile:     ['express_detail', 'exterior_wax', 'interior_deep', 'complete_detail', 'paint_correction', 'alacarte'],
  // Note: ceramic_coating NOT available on mobile
}
```

---

## API Endpoints

### POST /api/availability

Called by Bella mid-call to check open slots.

**Request body:**
```json
{
  "service": "interior_deep",
  "vehicleType": "suv",
  "location": "pikesville",
  "preferredDate": "2026-04-28"
}
```

**Logic:**
1. Look up service duration from database (interior_deep + suv = 180 min)
2. Look up location config (pikesville: capacity 2, buffer 15 min)
3. Check location hours for the requested day
4. Check same-day cutoff if date is today (pikesville has none)
5. Fetch existing events from Pikesville Google Calendar for that day
6. Fetch busy events from main Google Calendar for that day (PocketSuite overlay)
7. Merge both into occupied ranges
8. Generate all possible slots within business hours that fit the duration + buffer
9. Remove slots that conflict with occupied ranges, respecting capacity
10. Return up to 5 available slots as ISO 8601 strings

**Response:**
```json
{
  "result": "I found a few open slots for an Interior Deep Clean on your S-U-V at Pikesville. I have this Wednesday at ten AM, Thursday at one PM, or Saturday at nine AM. Which works best for you?",
  "slots": [
    "2026-04-30T10:00:00",
    "2026-05-01T13:00:00",
    "2026-05-02T09:00:00"
  ],
  "agentReaction": "speaks-once"
}
```

**Edge cases to handle:**
- No slots available → suggest next available day or different location
- Same-day mobile after 2pm → decline and offer tomorrow
- Service not available at requested location (e.g., ceramic coating mobile) → explain and suggest shop
- Requested date is a Sunday or holiday → inform and suggest next Monday
- Google Calendar API error → fall back gracefully, offer to take message

### POST /api/booking

Called by Bella after the caller selects a slot.

**Request body:**
```json
{
  "callerName": "John Smith",
  "callerPhone": "4435551234",
  "service": "interior_deep",
  "vehicleType": "suv",
  "location": "pikesville",
  "appointmentStart": "2026-04-30T10:00:00",
  "notes": "Customer mentioned pet hair — possible dirty vehicle add-on"
}
```

**Logic:**
1. Re-validate the slot is still available (double-check before writing)
2. Calculate appointment end time using duration from database
3. Create Google Calendar event on the correct location calendar
4. Insert booking record into Supabase bookings table, storing the Google event ID
5. Send email confirmation via Resend
6. Send SMS confirmation via Twilio
7. Return success message for Bella to read

**Response:**
```json
{
  "result": "The appointment is confirmed. Let the caller know their booking is set, they will receive a confirmation by text and email shortly, and that a credit card is needed to hold the appointment but there is no charge until after the service is complete.",
  "bookingId": "uuid-here",
  "agentReaction": "speaks-once"
}
```

**Edge cases to handle:**
- Slot taken between checkAvailability and confirmBooking (race condition) → apologize, re-run availability check, offer next slot
- Google Calendar write fails → do not save to database, return error to Bella, offer to take message
- SMS fails → log error, do not fail the booking, email still sends
- Email fails → log error, do not fail the booking, SMS still sends
- Invalid phone number format → sanitize and normalize before sending

### POST /api/transfer

Called by Bella when a transfer is needed. The backend does not place the phone call itself unless a telephony-provider API is added later. In v1, this endpoint returns deterministic transfer instructions for Bella/Ultravox to execute.

**Request body:**
```json
{
  "reason": "ceramic coating inquiry",
  "attempt": "primary"
}
```

**Logic:**
1. If `attempt` is missing or equals `primary`, return the primary transfer number: +14439574789
2. If Bella/Ultravox reports the primary transfer failed, Bella calls this endpoint again with `attempt: "secondary"`
3. Return the secondary transfer number: +14434633533
4. If both transfers fail, return a message asking Bella to collect name, phone, reason, and preferred callback time

**Response:**
```json
{
  "result": "I can connect you with our team now. Please hold for just a moment.",
  "transferTo": "+14439574789",
  "agentReaction": "transfer-call"
}
```

### GET /api/health

Simple health check endpoint. Returns 200 OK with timestamp. Used by Railway to confirm the server is running.

---

## Google OAuth Implementation

This is security-critical. Follow this exactly.

### Setup flow (one-time per account)

1. Admin dashboard shows "Connect Google Calendar" button
2. User clicks button → redirect to Google OAuth consent screen
3. Request these exact Google account scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
   
   Google scopes apply to the authorized account, not to individual calendars. The app must enforce calendar-level behavior in code:
   - Main calendar: read-only busy overlay
   - Pikesville, Towson, Mobile calendars: read + write booking events
4. Google redirects back to `/api/auth/google/callback` with an authorization code
5. Exchange code for access token and refresh token
6. Store the refresh token encrypted in `accounts.google_refresh_token_encrypted`
7. Store the access token encrypted only as a short-lived cache in `accounts.google_access_token_encrypted`
8. Store the expiry time in `accounts.google_token_expiry`
9. List calendars from the authorized account
10. Let Quintin map the main busy-overlay calendar and each bookable location calendar in the admin dashboard
11. Store the main calendar ID in `accounts.google_main_calendar_id`
12. Store location calendar IDs in `locations.google_calendar_id`

### Reconnect / disconnect flow

The admin dashboard must provide a "Disconnect Google Calendar" action. This clears:
- `accounts.google_refresh_token_encrypted`
- `accounts.google_access_token_encrypted`
- `accounts.google_token_expiry`
- `accounts.google_main_calendar_id`
- all `locations.google_calendar_id` values for the account

After disconnecting, the admin can click "Connect Google Calendar" again and authorize the correct Google account. This is required when the wrong Google account was connected during setup or when Quintin revokes access.

### Token refresh

Access tokens expire after 1 hour. Before every Google Calendar API call:

```javascript
async function getValidAccessToken(accountId) {
  const account = await getAccount(accountId)
  
  if (account.google_token_expiry > Date.now() + 60000) {
    // Token still valid for more than 1 minute
    return decryptToken(account.google_access_token_encrypted)
  }
  
  // Refresh the token
  const refreshToken = decryptToken(account.google_refresh_token_encrypted)
  const { access_token, expiry_date } = await refreshGoogleToken(refreshToken)
  
  // Update database
  await updateAccountTokens(accountId, encryptToken(access_token), expiry_date)
  
  return access_token
}
```

### Token revocation handling

If a refresh token fails (user revoked access), catch the error and:
1. Mark the account's `google_refresh_token_encrypted`, `google_access_token_encrypted`, and `google_token_expiry` as null in the database
2. Log the error
3. Return a clear error to Bella: "I'm unable to check availability right now. Please call back and a team member will assist you."
4. Send an alert email to the developer (you) so you can re-authenticate

---

## Admin Dashboard

### Pages and features

**Dashboard home (/dashboard)**
- Today's bookings across all locations — name, time, service, vehicle, phone
- Quick stats: bookings today, bookings this week, upcoming same-day slots remaining
- Alert banner if Google Calendar is disconnected

**Bookings view (/dashboard/bookings)**
- List of all upcoming bookings sortable by date and location
- Filter by location (Pikesville / Towson / Mobile)
- Each booking shows: customer name, phone, service, vehicle type, time, notes
- Status badges: confirmed, cancelled, completed, no-show
- Click a booking to see full details and update status

**Schedule manager (/dashboard/schedule)**
- Three location panels side by side (or stacked on mobile)
- Each panel shows the week view with current hours
- Edit button to change hours for a location
- Toggle to mark a location closed for a specific date (override)
- Same-day cutoff time setting per location

**Settings (/dashboard/settings)**
- Google Calendar connection status with Connect / Reconnect button
- Business hours summary
- Notification preferences

**Design principles for Quintin's UI:**
- Maximum 3 clicks to do anything
- No jargon — say "Block a day off" not "Create location override"
- Mobile-first — Quintin will use this on his phone
- No delete buttons without confirmation
- All actions show a success or error message immediately

---

## Security Requirements

Follow all of these without exception.

### Environment variables — never hardcode credentials
Every secret lives in environment variables only. Never commit secrets to GitHub. Use Railway's environment variable panel for production and a `.env` file locally (add `.env` to `.gitignore` immediately).

Required environment variables:
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
BELLA_API_KEY=
ENCRYPTION_KEY=
ADMIN_APP_URL=
BACKEND_URL=
NODE_ENV=
```

Admin dashboard environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BACKEND_URL=
```

### Sensitive data encryption
The Google refresh token is the most sensitive piece of data in the system. Encrypt it at rest before storing in Supabase using AES-256. The encryption key lives only in environment variables, never in the database.

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function encryptToken(token) {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv)
  const encrypted = Buffer.concat([cipher.update(token), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decryptToken(encrypted) {
  const [iv, encryptedText] = encrypted.split(':')
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedText, 'hex')), decipher.final()])
  return decrypted.toString()
}
```

### API authentication
All Bella-facing API endpoints (`/api/availability`, `/api/booking`, `/api/transfer`) must validate a shared secret API key in the request header:

```javascript
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key']
  if (!apiKey || apiKey !== process.env.BELLA_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
```

### Admin dashboard authentication
Use Supabase Auth for admin login. Store the session in secure httpOnly cookies through Supabase SSR helpers or equivalent server-side cookie handling. Never store admin access tokens in `localStorage`.

### Input validation
Validate and sanitize every input before using it:
- Service slugs must match the exact enum list
- Vehicle types must be one of: sedan, suv, truck, commercial
- Location slugs must match the exact enum list
- Phone numbers must be normalized to E.164 format (+1XXXXXXXXXX)
- Dates must be valid ISO 8601 strings
- Never pass raw user input into database queries — use parameterized queries always

### Rate limiting
Apply rate limiting to all API endpoints to prevent abuse:
```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute per IP
  message: { error: 'Too many requests' }
})

app.use('/api/', limiter)
```

### CORS
Only allow requests from known origins:
```javascript
const corsOptions = {
  origin: [
    process.env.ADMIN_APP_URL,
    'https://api.ultravox.ai',    // Ultravox tool calls
  ],
  optionsSuccessStatus: 200
}
```

---

## Error Handling

Every error must be handled explicitly. No unhandled promise rejections. No silent failures.

### The golden rule for Bella-facing errors
Never return a raw error or stack trace to Bella. Always return a human-readable `result` string she can speak to the caller. The caller should never hear Bella say "undefined" or "null" or "500 error."

```javascript
// Pattern for every Bella-facing endpoint
try {
  // ... logic
  return res.json({ result: "Success message for Bella to speak", agentReaction: "speaks-once" })
} catch (error) {
  logger.error('checkAvailability failed', { error: error.message, body: req.body })
  return res.json({
    result: "I'm having trouble checking availability right now. Could I take your name and number and have a team member call you back?",
    agentReaction: "speaks-once"
  })
}
```

### Specific error scenarios and responses

| Error | Bella says |
|---|---|
| Google Calendar API down | "I'm having trouble checking the schedule right now. Let me take your details and a team member will call you back to confirm." |
| Slot taken (race condition) | "It looks like that slot was just taken. Let me find you the next available time." Then re-run availability. |
| Google token expired/revoked | "I'm unable to access the calendar right now. Please call back and a team member can help you directly." |
| Supabase write fails | "I was unable to save your booking. Let me take your details and confirm this with our team." |
| SMS fails | Log error silently. Do not mention it to Bella. Email still sends. |
| Email fails | Log error silently. Do not mention it to Bella. SMS still sends. |
| Both SMS and email fail | Log error. Booking is still confirmed in the database and calendar. |

### Logging
Use structured logging for every request and error. Log at minimum:
- Timestamp
- Endpoint called
- Request body (sanitize phone numbers — log last 4 digits only)
- Response sent
- Duration in milliseconds
- Any errors with full stack trace

```javascript
import pino from 'pino'

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['body.callerPhone', 'body.customer_phone']
})
```

---

## Performance Requirements

Bella is waiting for these API responses mid-conversation. Latency is critical.

| Endpoint | Target response time | Maximum acceptable |
|---|---|---|
| /api/availability | < 800ms | 1500ms |
| /api/booking | < 1200ms | 2000ms |
| /api/transfer | < 300ms | 500ms |
| /api/health | < 100ms | 200ms |

To meet these targets:
- Keep the Railway server always-on (paid tier — no cold starts)
- Cache Google Calendar API responses for 30 seconds per location per day
- Use Promise.all() to fetch Pikesville calendar and main calendar simultaneously, not sequentially
- Keep database queries simple — no complex joins on the hot path
- Set Google Calendar API timeout to 3000ms and fail fast if exceeded

---

## Confirmation Messages

### Email confirmation (sent via Resend)
```
Subject: Your World Class Auto Detail Appointment is Confirmed

Hi [Customer Name],

Your appointment has been confirmed!

Service: [Service Name]
Vehicle: [Vehicle Type]
Location: [Location Name and Address]
Date & Time: [Formatted Date and Time]

Please note:
- A credit card is required to hold your appointment. You will not be charged until after the service is complete.
- Appointment requires 24 hours notice to cancel or reschedule.
- Please empty your vehicle before arrival for best results.

[If Towson]: Parking is fully covered. Take a ticket on entry, give it to our staff, and we will stamp it for free exit.

[If Mobile]: Our team will arrive fully equipped. Please ensure a driveway or parking lot is available.

Questions? Call us at (443) 957-4789.

Thank you for choosing World Class Auto Detail!
```

### SMS confirmation (sent via Twilio)
```
WCAD Appointment Confirmed! [Service] for your [Vehicle] at [Location] on [Date] at [Time]. Questions? Call 443-957-4789. Reply STOP to opt out.
```

---

## Project Folder Structure

Current implementation is intentionally incremental. Files marked **planned** are part of the v1 blueprint but are not expected to exist until their phase is built.

```
wcad-bella-backend/
├── CLAUDE.md                    ← This file
├── .env                         ← Never commit this
├── .env.example                 ← Commit this with blank values
├── .gitignore
├── package.json
├── railway.json                 ← Railway deployment config
├── tsconfig.json
│
├── src/
│   ├── app.ts                   ← Express app factory for runtime + tests
│   ├── index.ts                 ← Express server entry point
│   ├── middleware/
│   │   ├── auth.ts              ← API key validation
│   │   ├── rateLimit.ts         ← Rate limiting
│   │   └── validate.ts          ← Planned: shared input validation middleware
│   │
│   ├── routes/
│   │   ├── availability.ts      ← POST /api/availability
│   │   ├── booking.ts           ← Planned: POST /api/booking
│   │   ├── transfer.ts          ← Planned: POST /api/transfer
│   │   ├── auth.ts              ← Google OAuth flow
│   │   ├── google.ts            ← Google connection, calendar list, mapping, disconnect
│   │   └── health.ts            ← GET /api/health
│   │
│   ├── services/
│   │   ├── calendar.ts          ← All Google Calendar API logic
│   │   ├── accounts.ts          ← Account lookup and Google connection persistence
│   │   ├── availability.ts      ← Slot calculation logic
│   │   ├── booking.ts           ← Planned: booking creation logic
│   │   ├── notifications.ts     ← Planned: Resend + Twilio
│   │   └── token.ts             ← OAuth token management
│   │
│   ├── lib/
│   │   ├── supabase.ts          ← Supabase client
│   │   ├── encryption.ts        ← Token encryption/decryption
│   │   ├── env.ts               ← Environment parsing
│   │   ├── errors.ts            ← Application error helper
│   │   └── logger.ts            ← Pino logger config
│   │
│   └── config/
│       └── constants.ts         ← Enums, allowed values, static config
│
├── database/
│   ├── schema.sql               ← Full database schema
│   └── seed.ts                  ← Seed data for Quintin's account
│
├── test/
│   └── phase1-phase2.test.ts    ← Current backend smoke tests
│
└── admin/                       ← Planned: Next.js admin dashboard
    ├── pages/
    │   ├── dashboard/
    │   │   ├── index.tsx        ← Dashboard home
    │   │   ├── bookings.tsx     ← Bookings list
    │   │   ├── schedule.tsx     ← Hours and overrides
    │   │   └── settings.tsx     ← Google Calendar connection
    │   └── api/
    │       └── auth/
    │           └── callback.ts       ← Supabase Auth callback/session handling
    ├── components/
    ├── tsconfig.json
    └── package.json
```

---

## Build Order — Follow This Sequence

Claude Code should build in this sequence. Do not skip dependency steps or reorder major phases. The day labels are estimates only; real Google OAuth setup, external service credentials, deployment review, and production testing may extend the timeline.

### Phase 1 — Foundation (Estimated Day 1)
1. Initialize Node.js + Express + TypeScript project with folder structure above
2. Set up `.env.example` and `.gitignore`
3. Connect Supabase client
4. Run `schema.sql` to create all tables
5. Run `seed.ts` to populate Quintin's account data without requiring Google calendar IDs
6. Build `GET /api/health` endpoint
7. Deploy to Railway and confirm health check passes

### Phase 2 — Google Calendar (Estimated Day 1-2)
8. Set up Google Cloud project, enable Calendar API, create OAuth credentials
9. Build Google OAuth flow — `/api/auth/google` and `/api/auth/google/callback`
10. Store and encrypt refresh token in Supabase
11. Build token refresh logic
12. Build calendar list + mapping API so the system can store the main calendar and each location calendar
13. Build calendar read functions — fetch events, fetch free/busy
14. Test manually: confirm you can read mapped calendars from Quintin's account

Note: the calendar mapping UI is built later in Phase 5. During backend development, mapping can be tested directly through the API.

### Phase 3 — Availability (Estimated Day 2)
15. Build slot generation algorithm
16. Build busy time overlay logic (location calendar + main calendar)
17. Build capacity enforcement (2 simultaneous jobs)
18. Build buffer time logic
19. Build same-day cutoff logic (mobile only, 2pm)
20. Build missing-calendar-mapping guardrails
21. Build `POST /api/availability` endpoint end-to-end
22. Test with real calendar data

Current implementation note: Phase 3 backend availability is built and tested against mapped Google test calendars. The production connection still needs to be switched from the developer test Google account to Quintin's Google account before launch.

### Phase 4 — Booking (Estimated Day 2-3)
23. Build Google Calendar event creation
24. Build Supabase booking record insertion
25. Build Resend email confirmation
26. Build Twilio SMS confirmation
27. Build `POST /api/booking` endpoint end-to-end
28. Test full booking flow: call availability, select slot, confirm, verify calendar event created and confirmation sent

### Phase 5 — Admin Dashboard (Estimated Day 3)
29. Initialize Next.js project in `/admin`
30. Set up Supabase Auth for admin login
31. Build dashboard home — today's bookings
32. Build bookings list page with filters
33. Build schedule manager — hours and day overrides
34. Build settings page — Google Calendar connection status and calendar mapping
35. Deploy the admin dashboard to Vercel Pro or Railway

### Phase 6 — Hardening (Estimated Day 4)
36. Add input validation to all endpoints
37. Add rate limiting
38. Add CORS configuration
39. Add structured logging
40. Add error handling for all Google Calendar failure modes
41. Test race condition scenario (slot taken between availability check and booking)
42. Run all test cases from the Bella test plan

---

## Testing Checklist

Before going live, every item on this list must pass.

### API tests
- [ ] `/api/health` returns 200
- [ ] `/api/availability` with valid inputs returns slots in correct format
- [ ] `/api/availability` returns no slots when calendar is fully booked
- [ ] `/api/availability` respects capacity (no more than 2 overlapping jobs)
- [ ] `/api/availability` respects buffer time between appointments
- [ ] `/api/availability` blocks time from main calendar (PocketSuite overlay)
- [ ] `/api/availability` returns error gracefully when Google Calendar is down
- [ ] `/api/availability` mobile after 2pm returns correct decline message
- [ ] `/api/booking` creates event on correct location calendar
- [ ] `/api/booking` saves record to Supabase
- [ ] `/api/booking` sends SMS confirmation
- [ ] `/api/booking` sends email confirmation
- [ ] `/api/booking` handles race condition gracefully
- [ ] All endpoints reject requests without valid API key
- [ ] All endpoints sanitize inputs and reject invalid values

### Bella integration tests
- [ ] Full booking call: name → phone → service → vehicle → location → slot → confirm
- [ ] Same-day mobile after 2pm correctly declined
- [ ] Ceramic coating at mobile correctly refused and transferred
- [ ] Transfer fires when triggered
- [ ] Secondary number tried when primary fails
- [ ] Graceful degradation when availability API fails mid-call

### Admin dashboard tests
- [ ] Admin can log in
- [ ] Today's bookings display correctly
- [ ] Booking status can be updated
- [ ] Location hours can be edited
- [ ] Day override can be created and removes slots from availability
- [ ] Google Calendar reconnect flow works

---

## What NOT to Build in v1

Keep scope tight. These are explicitly out of scope for the first version.

- Staff-level scheduling — Quintin manages his own team assignments
- PocketSuite direct integration — not possible, no API
- Customer-facing booking page — Bella handles all bookings by voice
- Payment processing — card collection is handled by staff after the call
- Multi-account onboarding UI — Quintin is the only account, seed data handles setup
- Analytics or reporting — future phase
- Automated weather cancellations for mobile — staff handles this manually

---

## Ongoing Maintenance Notes

**When Quintin changes his hours:** Update `location_hours` table directly in Supabase dashboard or build a simple admin UI form. Do not require a code change for hour updates.

**When Google token expires:** The system auto-refreshes. If the refresh token is revoked (Quintin changes Google password or revokes access), the admin dashboard will show a "Reconnect Google Calendar" alert. Quintin clicks it, re-authorizes, done.

**When a new service is added:** Insert into `services`, `service_durations`, `pricing`, and `service_locations` tables. Update the Bella system prompt to reflect the new service.

**When a second client onboards:** The multi-tenant structure is already in place. Add a new row to `accounts`, seed their locations and services, and run them through the OAuth flow in the admin dashboard. No code changes needed.

---

---

## Design System & PWA Strategy

### Design Philosophy — “Dark Luxury Operations Interface”

The admin dashboard is not a generic SaaS UI. It represents a premium, real-world service business. The design should evoke the feeling of a high-end car interior — refined, minimal, and confident.

**Core direction:**
- Deep charcoal and near-black surfaces
- Warm cream text for readability without harsh contrast
- Gold used sparingly as a premium accent
- Subtle texture (noise/grain) to add tactile depth
- Clean, spacious layouts with intentional hierarchy

This is not a flashy interface. It should feel **expensive, calm, and in control** — like a Rolls Royce dashboard translated into software.

---

### Color System

| Purpose | Color |
|--------|------|
| Background | `#0D0D0F` (near-black) |
| Primary text | `#F5F0E8` (warm off-white) |
| Accent (gold) | `#C9A84C` |
| Surface gray | Warm dark gray (slightly lifted from background) |

**Usage rules:**
- Gold is used only for:
  - Active states
  - Key metrics
  - Highlights (e.g., Bella status)
- Avoid overuse — it should feel rare and intentional

---

### Typography System

| Use Case | Font |
|--------|------|
| Headings | DM Serif Display |
| Body text | DM Sans |
| Numbers / Time / Stats | DM Mono |

**Guidelines:**
- Numbers must always use monospace
- Headers should feel strong but not oversized
- Maintain consistent spacing rhythm

---

### Location Color Coding

| Location | Color |
|---------|------|
| Pikesville | Gold |
| Towson | Blue |
| Mobile | Green |

Must remain consistent across all views.

---

### UI Principles

- Maximum clarity in minimum space  
- No clutter — every element must justify its presence  
- Touch-friendly components  
- Clear hierarchy:
  - What’s happening today  
  - What needs attention  
  - What’s coming next  

---

### Mobile-First, Desktop-Strong

Primary usage is mobile, but must scale cleanly to desktop.

**Requirements:**
- One-hand usability on mobile  
- Key info visible quickly  
- Desktop expands layout, not stretches it  

**Behavior:**
- Responsive layout  
- Cards stack on mobile  
- Grid alignment on desktop  
- Sidebar → drawer on mobile  

---

### Progressive Web App (PWA)

The dashboard must be a **lightweight PWA**.

**Goals:**
- Installable on home screen  
- App-like experience  
- Fast repeat access  
- Smooth transitions  

**Requirements:**
- Add-to-home-screen support  
- App icon + splash screen  
- Cache static assets (fonts, UI shell)  

**Constraint:**
- Booking requires live data  
- No offline booking in v1  

---

### Visual Quality Standard

This UI must feel:

- Polished  
- Intentional  
- Production-grade  
- Premium  

Test:

> If Quintin opens it, it should feel like he’s running a serious operation.

## Cost Summary

| Service | Cost |
|---|---|
| Railway (backend hosting, always-on) | $5/month |
| Supabase | Free for MVP; upgrade when storage, backups, or production reliability needs exceed free tier |
| Admin dashboard hosting | Vercel Pro at $20/month, or Railway if keeping backend and admin together |
| Google Calendar API | No additional API cost; quota/rate limits still apply |
| Resend (email confirmations) | Free up to 3,000/month |
| Twilio (SMS confirmations) | Usage-based; expect phone number rental, per-segment SMS cost, carrier fees, and possible A2P 10DLC setup |
| GitHub Codespaces (development) | Free up to 60hrs/month |
| **Realistic MVP total** | **~$10-$30/month plus SMS usage** |
