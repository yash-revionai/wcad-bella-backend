import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-api-key",
      "req.body.callerPhone",
      "req.body.customer_phone",
      "req.body.customerPhone",
      "body.callerPhone",
      "body.customer_phone",
      "body.customerPhone"
    ],
    censor: "[redacted]"
  }
});

