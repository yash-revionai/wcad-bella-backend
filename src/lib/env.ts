import "dotenv/config";
import { z } from "zod";
import { AppError } from "./errors.js";

const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(blankAsUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(blankAsUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_KEY: optionalString,
  SUPABASE_ANON_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalUrl,
  RESEND_API_KEY: optionalString,
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_PHONE_NUMBER: optionalString,
  ADMIN_APP_URL: optionalUrl,
  BACKEND_URL: optionalUrl,
  BELLA_API_KEY: z.preprocess(blankAsUndefined, z.string().min(16).optional())
});

export const env = envSchema.parse(process.env);

export function requireEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_KEY" | "BELLA_API_KEY") {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function requireGoogleEnv() {
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"].filter((name) => {
    const value = process.env[name];
    return !value || value.includes("REPLACE");
  });

  if (missing.length > 0) {
    throw new AppError(`Missing required Google OAuth environment variables: ${missing.join(", ")}`, 503);
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!
  };
}
