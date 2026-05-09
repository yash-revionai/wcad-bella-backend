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
  res.set("X-Ultravox-Agent-Reaction", "speaks");

  try {
    const parsed = callerInfoSchema.parse(req.body);
    const supabase = createServiceSupabaseClient();

    const { error } = await supabase.from("call_sessions").upsert(
      { ultravox_call_id: parsed.callId, caller_name: parsed.callerName },
      { onConflict: "ultravox_call_id" }
    );

    if (error) {
      logger.warn({ callId: parsed.callId, error }, "Failed to upsert call session");
    } else {
      logger.info({ callId: parsed.callId, callerName: parsed.callerName }, "Caller name captured");
    }

    res.json({ result: "", agentReaction: "speaks" });
  } catch (error) {
    logger.error({ error }, "callerInfo endpoint error");
    res.json({ result: "", agentReaction: "speaks" });
  }
});
