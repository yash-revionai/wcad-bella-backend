import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { z } from "zod";
import { resolveAccount } from "../services/accounts.js";
import { buildGoogleAuthUrl, exchangeGoogleCode } from "../services/token.js";

export const authRouter = Router();

const accountIdQuerySchema = z.object({
  accountId: z.string().uuid().optional()
});

const googleCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().uuid()
});

authRouter.get("/google", async (req, res, next) => {
  try {
    const parsed = accountIdQuerySchema.parse({
      accountId: typeof req.query.accountId === "string" ? req.query.accountId : undefined
    });
    const account = await resolveAccount(parsed.accountId);
    const authUrl = buildGoogleAuthUrl(account.id);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/google/callback", async (req, res, next) => {
  try {
    const parsed = googleCallbackQuerySchema.parse({
      code: typeof req.query.code === "string" ? req.query.code : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined
    });

    await exchangeGoogleCode(parsed.state, parsed.code);

    res.status(200).send(`
      <!doctype html>
      <html>
        <head><title>Google Calendar Connected</title></head>
        <body>
          <h1>Google Calendar connected</h1>
          <p>You can close this window and return to Bella admin.</p>
        </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
});
