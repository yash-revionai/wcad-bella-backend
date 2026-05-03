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
import { authRouter } from "./routes/auth.js";
import { bookingRouter } from "./routes/booking.js";
import { googleRouter } from "./routes/google.js";
import { healthRouter } from "./routes/health.js";
import { transferRouter } from "./routes/transfer.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.ADMIN_APP_URL ? [env.ADMIN_APP_URL, "https://api.ultravox.ai"] : true,
      optionsSuccessStatus: 200
    })
  );
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

  app.use("/api/health", healthRouter);
  app.use("/api/availability", availabilityRouter);
  app.use("/api/booking", bookingRateLimit, bookingRouter);
  app.use("/api/transfer", transferRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/google", validateAdminApiKey, googleRouter);

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
