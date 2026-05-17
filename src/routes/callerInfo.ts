import { Router } from "express";
import { z } from "zod";
import { createServiceSupabaseClient } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { validateApiKey } from "../middleware/auth.js";

export const callerInfoRouter = Router();

const callerInfoSchema = z
  .object({
    callId: z.string().trim().min(1).max(200),
    callerName: z.string().trim().min(1).max(200)
  })
  .strict();

callerInfoRouter.post("/", validateApiKey, async (req, res) => {
  try {
    const retellBody = req.body as Record<string, unknown>;
    const args = (retellBody?.args as Record<string, unknown>) ?? retellBody;
    const callId = args?.callId ?? (retellBody?.call as Record<string, unknown>)?.call_id;
    const parsed = callerInfoSchema.parse({ ...args, callId });
    const supabase = createServiceSupabaseClient();

    const { error } = await supabase.from("call_sessions").upsert(
      { retell_call_id: parsed.callId, caller_name: parsed.callerName },
      { onConflict: "retell_call_id" }
    );

    if (error) {
      logger.warn({ callId: parsed.callId, error }, "Failed to upsert call session");
    } else {
      logger.info({ callId: parsed.callId, callerName: parsed.callerName }, "Caller name captured");
    }

    res.json({ result: "" });
  } catch (error) {
    logger.error({ error }, "callerInfo endpoint error");
    res.json({ result: "" });
  }
});
