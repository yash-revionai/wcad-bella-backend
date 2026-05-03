# WCAD Bella — AI Receptionist & Booking System
## Project Development Guide

---

## Overview

**Bella** is an AI voice receptionist for **World Class Auto Detail** (WCAD) in Baltimore, MD. She handles inbound calls 24/7, checks real-time availability, and confirms appointments without human callback.

This repository contains:
1. **Backend API** (Node.js + Express) — Handles availability checks, booking confirmations, and calendar integration
2. **Admin Dashboard** (Next.js + TypeScript) — Allows Quintin to manage bookings, hours, and Google Calendar

---

## Current Status: ✅ Production-Ready (Phase 1-2 Complete)

### What's Built ✅
- [x] Backend API with all Bella-facing endpoints
- [x] Google OAuth 2.0 integration with token encryption
- [x] Availability checking with slot generation algorithm
- [x] Booking confirmation with idempotency & race condition handling
- [x] Email (Resend) and SMS (Twilio) confirmations
- [x] Admin dashboard with 5 pages (Dashboard, Bookings, Schedule, Settings, Locations)
- [x] Database schema (10 tables with RLS)
- [x] Error monitoring and logging
- [x] Rate limiting and security (API keys, CORS, input validation)
- [x] 34 passing tests (unit, integration, E2E)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js 20+ / Express / TypeScript |
| Database | Supabase (PostgreSQL) with RLS |
| Admin UI | Next.js 14+ / React / TypeScript |
| Styling | Tailwind CSS |
| Calendar | Google Calendar API v3 |
| Email | Resend API |
| SMS | Twilio API |
| Encryption | AES-256-GCM |
| Validation | Zod |
| Logging | Pino |

---

## Project Structure

```
wcad-bella-backend/
├── src/
│   ├── app.ts                 ← Express app factory
│   ├── index.ts               ← Server entry point
│   ├── middleware/
│   │   ├── auth.ts            ← API key validation
│   │   └── rateLimit.ts       ← Rate limiting
│   ├── routes/
│   │   ├── availability.ts    ← POST /api/availability
│   │   ├── booking.ts         ← POST /api/booking
│   │   ├── transfer.ts        ← POST /api/transfer
│   │   ├── health.ts          ← GET /api/health
│   │   ├── auth.ts            ← Google OAuth flow
│   │   └── google.ts          ← Google connection management
│   ├── services/
│   │   ├── availability.ts    ← Slot generation algorithm
│   │   ├── booking.ts         ← Booking logic with idempotency
│   │   ├── calendar.ts        ← Google Calendar API calls
│   │   ├── notifications.ts   ← Email/SMS delivery
│   │   ├── accounts.ts        ← Account & token management
│   │   └── token.ts           ← OAuth token refresh
│   ├── lib/
│   │   ├── supabase.ts        ← Supabase client
│   │   ├── encryption.ts      ← Token encryption/decryption
│   │   ├── env.ts             ← Environment validation (Zod)
│   │   ├── errors.ts          ← AppError class
│   │   ├── logger.ts          ← Pino logging
│   │   ├── phone.ts           ← Phone number normalization
│   │   └── monitoring.ts      ← Error monitoring & alerts
│   └── config/
│       └── constants.ts       ← Enums & allowed values
├── database/
│   ├── schema.sql             ← Full PostgreSQL schema
│   └── seed.ts                ← Seed data for Quintin's account
├── test/
│   ├── phase1-phase2.test.ts  ← 21 unit/integration tests
│   └── e2e-bella-integration.test.ts ← 13 E2E tests
└── admin/                     ← Next.js admin dashboard
    ├── src/app/
    │   ├── page.tsx           ← Login page
    │   └── dashboard/
    │       ├── page.tsx       ← Home (today's bookings)
    │       ├── bookings/      ← Bookings list & status
    │       ├── schedule/      ← Hours & day overrides
    │       ├── settings/      ← Google Calendar connection
    │       └── locations/     ← Location details
    ├── src/lib/
    │   ├── admin-auth.ts      ← Auth functions & RLS
    │   ├── admin-data.ts      ← Data fetching for pages
    │   └── env.ts             ← Environment validation
    └── package.json
```

---

## API Endpoints (Bella-Facing)

### POST /api/availability
Checks open slots for a service, vehicle, location, and date.

**Request:**
```json
{
  "service": "interior_deep",
  "vehicleType": "suv",
  "location": "pikesville",
  "preferredDate": "2026-05-10"
}
```

**Response:**
```json
{
  "result": "I found open slots for an Interior Deep Clean on your S-U-V at Pikesville...",
  "slots": ["2026-05-10T10:00:00", "2026-05-10T14:00:00"],
  "agentReaction": "speaks-once"
}
```

**Key Features:**
- Respects business hours, location capacity (2 concurrent jobs), and buffer time (15-30 min)
- Mobile location has 2pm same-day cutoff
- Checks both location calendar + main "PocketSuite overlay" calendar
- Returns graceful error messages if slots unavailable

---

### POST /api/booking
Confirms a booking and creates calendar event + sends confirmations.

**Request:**
```json
{
  "callerName": "John Smith",
  "callerPhone": "4435551234",
  "service": "interior_deep",
  "vehicleType": "suv",
  "location": "pikesville",
  "appointmentStart": "2026-05-10T10:00:00",
  "idempotencyKey": "optional-unique-key"
}
```

**Response:**
```json
{
  "result": "The appointment is confirmed. Let the caller know...",
  "bookingId": "uuid",
  "agentReaction": "speaks-once"
}
```

**Key Features:**
- Creates Google Calendar event
- Saves booking to Supabase
- Sends SMS + email confirmations (with location-specific info)
- Idempotent: same request with same idempotencyKey returns same booking
- Handles race conditions: re-checks slot availability before confirming

---

### POST /api/transfer
Returns transfer phone number when customer needs staff.

**Request:**
```json
{
  "reason": "ceramic_coating_inquiry",
  "attempt": "primary"
}
```

**Response:**
```json
{
  "result": "I can connect you with our team now...",
  "transferTo": "+14439574789",
  "agentReaction": "transfer-call"
}
```

**Numbers:**
- Primary: +1 (443) 957-4789
- Secondary (if primary fails): +1 (443) 463-3533

---

### GET /api/health
Health check for deployment monitors.

**Response:**
```json
{
  "status": "ok",
  "service": "wcad-bella-backend",
  "timestamp": "2026-05-03T18:30:00Z"
}
```

---

## Database Schema

### Core Tables
- `accounts` — Business account (currently 1: Quintin's)
- `locations` — Pikesville, Towson, Mobile
- `location_hours` — Operating hours per day of week
- `location_overrides` — One-off closures/changes
- `services` — Service offerings (Express Detail, Interior Deep, etc.)
- `service_durations` — Duration per service × vehicle type
- `service_locations` — Which services available at which locations
- `pricing` — Price per service × vehicle type
- `bookings` — All confirmed appointments
- `admin_users` — Admin login credentials

### Key Constraints
- All locations belong to one account (multi-tenancy ready)
- Row-level security on bookings & admin_users
- Foreign key cascades for cleanup
- Check constraints on enums (vehicle types, service slugs, etc.)

---

## Google Calendar Integration

**Setup (One-Time):**
1. Admin clicks "Connect Google Calendar" in settings
2. Redirects to Google OAuth consent screen
3. User authorizes app for calendar access
4. System exchanges auth code for tokens (refresh + access)
5. Stores encrypted refresh token in `accounts.google_refresh_token_encrypted`
6. Lists user's calendars, lets admin map:
   - Main calendar → `accounts.google_main_calendar_id` (read-only busy overlay)
   - Pikesville calendar → `locations.google_calendar_id` (read + write)
   - Towson calendar → `locations.google_calendar_id` (read + write)
   - Mobile calendar → `locations.google_calendar_id` (read + write)

**Token Management:**
- Access tokens auto-refresh when expired (1-hour TTL)
- Refresh token survives if stored encrypted
- If refresh fails, admin must re-authorize in settings

**Availability Logic:**
1. Fetch events from location calendar (existing bookings)
2. Fetch events from main calendar (PocketSuite jobs + blocks)
3. Merge into busy time ranges
4. Generate slots around busy times respecting:
   - Service duration
   - Buffer time (15 min shops, 30 min mobile)
   - Capacity (2 concurrent jobs)
   - Same-day cutoff (mobile only: 2pm)

---

## Admin Dashboard Pages

### Dashboard (`/dashboard`)
- Today's bookings table (name, time, service, vehicle, phone)
- This week's stats (count, revenue)
- Bella connection status

### Bookings (`/dashboard/bookings`)
- List all upcoming bookings
- Filter by location, status (confirmed/cancelled/completed/no-show)
- Click to view details and update status

### Schedule (`/dashboard/schedule`)
- Block day off form (location, date, reason)
- Active blocks list with delete option
- Per-location hours editor (9-5 defaults)
- Same-day mobile cutoff time (default 2pm)

### Settings (`/dashboard/settings`)
- Google Calendar connection status
- Connect/Reconnect/Disconnect buttons
- Calendar mapping form (choose which Google calendar = which location)
- SMS/Email capability status (shows if keys configured)

### Locations (`/dashboard/locations`)
- View all locations (Pikesville, Towson, Mobile)
- Capacity and buffer times

---

## Security & Performance

### API Authentication
- All Bella endpoints require `x-api-key` header
- Admin endpoints require `x-admin-api-key` header
- Keys stored as environment variables only

### Rate Limiting
- General endpoints: 30 requests/minute per IP
- Booking endpoint: 5 requests/minute per IP

### Encryption
- Google refresh tokens: AES-256-GCM at rest
- Passwords: Not stored (Supabase Auth handles)

### Input Validation
- Zod schemas on all endpoints
- Phone numbers normalized to E.164 (+1XXXXXXXXXX)
- Dates must be ISO 8601 or YYYY-MM-DD
- Service/vehicle/location slugs must match enum

### Error Handling
- Never returns stack traces to Bella
- All errors get human-readable messages Bella can speak
- Failures gracefully degrade (e.g., SMS fails but booking succeeds)
- Structured logging for debugging

### Performance Targets
- Availability: < 800ms (target), < 1500ms (max)
- Booking: < 1200ms (target), < 2000ms (max)
- Transfer: < 300ms (target), < 500ms (max)

---

## Monitoring

The system logs and alerts on:
- **Failed confirmations** — Email or SMS delivery failure after booking created
- **Google Calendar errors** — Rate limiting, unavailability, token refresh failures
- **Race conditions** — Slot taken between availability check and booking
- **Slow requests** — API responses > 800ms

All logs are structured for integration with Datadog, Sentry, or CloudWatch.

---

## Testing

### Test Coverage: 34/34 Passing ✅

**Unit & Integration (21 tests)**
- API key validation
- Availability slot generation (capacity, buffer, cutoff)
- Booking idempotency
- Race condition handling
- Phone normalization
- Google event parsing
- Error degradation

**E2E Integration (13 tests)**
- Full availability → booking flow
- Transfer endpoints
- Health check
- Input validation
- API key enforcement

**Run Tests:**
```bash
npm test
```

**Load Test Availability:**
```bash
npx ts-node test/load-test-availability.ts
```

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://...supabase.co/
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Google OAuth
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# External APIs
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+18623100216

# Security
ENCRYPTION_KEY=<32-byte hex string>
BELLA_API_KEY=<min 16 chars>
ADMIN_API_KEY=<min 16 chars>

# App URLs
ADMIN_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
NODE_ENV=development
PORT=3001
```

See `.env.example` for template.

---

## Running Locally

### Backend
```bash
npm install
npm run dev              # Watch mode with tsx
npm run build          # TypeScript compilation
npm test               # Run all tests
npm run seed           # Populate database with seed data
```

### Admin Dashboard
```bash
cd admin
npm install
npm run dev            # Next.js dev server on port 3000
npm run build
npm start
```

---

## Deployment

### Backend → Railway
1. Push to GitHub
2. Railway auto-deploys on `main` push
3. Set environment variables in Railway dashboard

### Admin → Vercel Pro or Railway
1. Push to GitHub
2. Vercel/Railway auto-deploys
3. Set environment variables

---

## What's NOT Included (Out of Scope)

- Payment processing (handled by staff after call)
- PocketSuite direct integration (only reads via calendar)
- Customer portal (Bella is the interface)
- Multi-account onboarding (Quintin is the only account)
- Staff scheduling (Quintin manages manually)
- Analytics dashboard (future phase)

---

## File to Remember

- **FIXES_SUMMARY.md** — Latest changes and monitoring additions
- **.env.example** — Template for environment variables
- **database/schema.sql** — Full PostgreSQL schema
- **database/seed.ts** — Seed data and setup

---

## Support & Debugging

**Tests failing?**
```bash
npm run build          # Check TypeScript errors
npm test               # Run all tests
```

**API not responding?**
- Check `.env` has all required variables
- Check SUPABASE_URL and keys are valid
- Check Supabase dashboard for connection

**Google Calendar not syncing?**
- Check /api/admin/settings for connection status
- If disconnected, admin must click "Reconnect"
- If failing, check credentials in .env

**Booking not creating event?**
- Check Google Calendar is connected in admin
- Check calendar IDs are mapped for each location
- Check calendar event logs in Supabase

---

## Questions?

Refer to:
- **Code comments** in src/services for business logic
- **Test files** for usage examples
- **database/schema.sql** for data model
- **FIXES_SUMMARY.md** for recent changes
