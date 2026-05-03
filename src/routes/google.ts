import { Router } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import { locationSlugs } from "../config/constants.js";
import { clearCalendarMappings, clearGoogleTokens, resolveAccount } from "../services/accounts.js";
import { clearEventCacheForAccount, listGoogleCalendars } from "../services/calendar.js";
import { calendarScopesForDisplay } from "../services/token.js";

export const googleRouter = Router();

const accountIdQuerySchema = z.object({
  accountId: z.string().uuid().optional()
});

const mappingSchema = z.object({
  accountId: z.string().uuid().optional(),
  mainCalendarId: z.string().min(1),
  locations: z.object({
    pikesville: z.string().min(1),
    towson: z.string().min(1),
    mobile: z.string().min(1)
  })
}).strict();

googleRouter.get("/status", async (req, res, next) => {
  try {
    const parsed = accountIdQuerySchema.parse({
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });
    const account = await resolveAccount(parsed.accountId);
    res.json({
      accountId: account.id,
      connected: Boolean(account.google_refresh_token_encrypted),
      mainCalendarMapped: Boolean(account.google_main_calendar_id),
      scopes: calendarScopesForDisplay()
    });
  } catch (error) {
    next(error);
  }
});

googleRouter.get("/calendars", async (req, res, next) => {
  try {
    const parsed = accountIdQuerySchema.parse({
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });
    const account = await resolveAccount(parsed.accountId);
    const calendars = await listGoogleCalendars(account.id);
    res.json({ calendars });
  } catch (error) {
    next(error);
  }
});

googleRouter.get("/mapping", async (req, res, next) => {
  try {
    const parsed = accountIdQuerySchema.parse({
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });
    const account = await resolveAccount(parsed.accountId);
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("locations")
      .select("slug,name,google_calendar_id")
      .eq("account_id", account.id)
      .in("slug", [...locationSlugs])
      .order("slug");

    if (error) {
      throw new AppError(`Unable to load calendar mapping: ${error.message}`, 500);
    }

    res.json({
      accountId: account.id,
      mainCalendarId: account.google_main_calendar_id,
      locations: data ?? []
    });
  } catch (error) {
    next(error);
  }
});

googleRouter.put("/mapping", async (req, res, next) => {
  try {
    const parsed = mappingSchema.parse(req.body);
    const account = await resolveAccount(parsed.accountId);
    const supabase = createServiceSupabaseClient();

    const { error: accountError } = await supabase
      .from("accounts")
      .update({ google_main_calendar_id: parsed.mainCalendarId })
      .eq("id", account.id);

    if (accountError) {
      throw new AppError(`Unable to save main calendar mapping: ${accountError.message}`, 500);
    }

    for (const [slug, googleCalendarId] of Object.entries(parsed.locations)) {
      const { error } = await supabase
        .from("locations")
        .update({ google_calendar_id: googleCalendarId })
        .eq("account_id", account.id)
        .eq("slug", slug);

      if (error) {
        throw new AppError(`Unable to save ${slug} calendar mapping: ${error.message}`, 500);
      }
    }

    clearEventCacheForAccount(account.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

googleRouter.delete("/connection", async (req, res, next) => {
  try {
    const parsed = accountIdQuerySchema.parse({
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });
    const account = await resolveAccount(parsed.accountId);
    await clearGoogleTokens(account.id);
    await clearCalendarMappings(account.id);
    clearEventCacheForAccount(account.id);

    res.json({
      ok: true,
      connected: false,
      mainCalendarMapped: false
    });
  } catch (error) {
    next(error);
  }
});
