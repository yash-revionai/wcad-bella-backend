import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { IncomingMessage } from "node:http";
import { env } from "./lib/env.js";
import { isAppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { validateAdminApiKey } from "./middleware/auth.js";
import { apiRateLimit, bookingRateLimit } from "./middleware/rateLimit.js";
import { availabilityRouter } from "./routes/availability.js";
import { bookingRouter } from "./routes/booking.js";
import { callbackRequestRouter } from "./routes/callbackRequest.js";
import { callerInfoRouter } from "./routes/callerInfo.js";
import { callLogsRouter } from "./routes/callLogs.js";
import { googleRouter } from "./routes/google.js";
import { healthRouter } from "./routes/health.js";
import { timeRouter } from "./routes/time.js";
import { transferRouter } from "./routes/transfer.js";
import { webhookRouter } from "./routes/webhook.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.ADMIN_APP_URL ? [env.ADMIN_APP_URL] : true,
      optionsSuccessStatus: 200
    })
  );

  // Webhook routes registered before express.json() so raw body is available for HMAC verification
  app.use("/api/webhooks", webhookRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req: IncomingMessage) {
          return {
            method: req.method,
            url: req.url,
            headers: req.headers
          };
        }
      }
    })
  );
  app.use("/api", apiRateLimit);

  app.get("/", (_req, res) => {
    res.send("<html><body><h1>Bella WCAD — AI Receptionist</h1><p>Internal scheduling API for World Class Auto Detail.</p><a href='/privacy'>Privacy Policy</a> | <a href='/tos'>Terms of Service</a></body></html>");
  });

  app.get("/privacy", (_req, res) => {
    res.type("text/plain").send(`Privacy Policy — Bella AI Receptionist (World Class Auto Detail)
Last updated: May 17, 2026

This application ("Bella") is an internal business tool used exclusively by
World Class Auto Detail (WCAD), operated by Quintin, located in Baltimore, MD.

DATA ACCESSED
Bella accesses Google Calendar data (read and write) for the sole purpose of:
- Checking appointment availability across WCAD locations
- Creating appointment calendar events when a booking is confirmed

DATA USAGE
- Calendar data is never sold, shared, or transferred to any third party
- No calendar content is stored beyond what is needed to complete a booking
- Access is limited to calendars explicitly authorized by the business owner

DATA RETENTION
Booking details (customer name, phone, service, appointment time) are stored
in a private database accessible only to WCAD staff. Google Calendar tokens
are stored encrypted and used only to authenticate API requests.

ACCESS CONTROL
Only the authorized WCAD business owner account may connect Google Calendar
to this application.

CONTACT
revionaico@gmail.com`);
  });

  app.get("/tos", (_req, res) => {
    res.type("text/plain").send(`Terms of Service — Bella AI Receptionist (World Class Auto Detail)
Last updated: May 17, 2026

This application is an internal business tool operated exclusively for
World Class Auto Detail (WCAD).

USE
This application is not available to the general public. Access is restricted
to the WCAD business owner and authorized staff only.

GOOGLE CALENDAR INTEGRATION
By connecting a Google account, the user authorizes Bella to read calendar
events and create booking events on designated WCAD calendars. This
authorization may be revoked at any time via Google account settings or
the WCAD admin dashboard.

LIMITATION OF LIABILITY
This tool is provided as-is for internal scheduling purposes. WCAD and its
developers are not liable for scheduling errors arising from incorrect calendar
configuration or connectivity issues with third-party services.

CONTACT
revionaico@gmail.com`);
  });

  app.use("/api/health", healthRouter);
  app.use("/api/time", timeRouter);
  app.use("/api/availability", availabilityRouter);
  app.use("/api/booking", bookingRateLimit, bookingRouter);
  app.use("/api/callback-request", callbackRequestRouter);
  app.use("/api/caller-info", callerInfoRouter);
  app.use("/api/transfer", transferRouter);
  app.use("/api/google", validateAdminApiKey, googleRouter);
  app.use("/api/admin/call-logs", validateAdminApiKey, callLogsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (isAppError(error)) {
      logger.warn({ error }, "Application error");
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error.name === "ZodError") {
      logger.warn({ error }, "Request validation failed");
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    logger.error({ error }, "Unhandled application error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
