import { Router } from "express";
import { z } from "zod";
import { formatPhoneForDisplay, normalizeUsPhoneNumber } from "../lib/phone.js";
import { logger } from "../lib/logger.js";
import { validateApiKey } from "../middleware/auth.js";
import { sendOwnerNotification } from "../services/notifications.js";

export const callbackRequestRouter = Router();

const callbackCategories = ["owner_contact", "failed_transfer", "post_service", "general_callback"] as const;

const callbackRequestSchema = z
  .object({
    callerName: z.string().trim().min(1).max(200),
    callerPhone: z.string().trim().min(1).max(40),
    reason: z.string().trim().min(1).max(1000),
    category: z.enum(callbackCategories)
  })
  .strict();

function categoryLabel(category: (typeof callbackCategories)[number]) {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

callbackRequestRouter.post("/", validateApiKey, async (req, res) => {
  try {
    const body = (req.body as Record<string, unknown>)?.args ?? req.body;
    const parsed = callbackRequestSchema.parse(body);
    const normalizedPhone = normalizeUsPhoneNumber(parsed.callerPhone);
    const displayedPhone = formatPhoneForDisplay(normalizedPhone);
    const submittedAt = new Date().toISOString();

    const alertSent = await sendOwnerNotification(
      `📋 Callback Request — ${parsed.callerName} — ${categoryLabel(parsed.category)}`,
      [
        "A caller requested a callback through Bella.",
        "",
        `Name: ${parsed.callerName}`,
        `Phone: ${displayedPhone}`,
        `Category: ${categoryLabel(parsed.category)}`,
        `Reason: ${parsed.reason}`,
        `Received: ${submittedAt}`
      ].join("\n")
    );

    logger.info(
      {
        callerName: parsed.callerName,
        callerPhone: displayedPhone,
        category: parsed.category,
        alertSent
      },
      "Callback request received"
    );

    if (!alertSent) {
      res.json({
        saved: false,
        result:
          "I was not able to save that callback request right now. Please ask the caller to try calling back shortly or visit the World Class Auto Detail website for more information."
      });
      return;
    }

    res.json({
      saved: true,
      result: "Callback request saved. Let the caller know their information is noted for the appropriate team member."
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.json({
        saved: false,
        result:
          "I did not get enough valid callback details. Please confirm the caller's name, full ten-digit callback phone number, callback reason, and callback category."
      });
      return;
    }

    if (error instanceof Error && /valid 10-digit/i.test(error.message)) {
      res.json({
        saved: false,
        result:
          "I need the full ten-digit callback phone number before I can save that request. Please ask the caller to repeat the number digit by digit, then read it back in three groups to confirm."
      });
      return;
    }

    logger.error({ error }, "Callback request failed");
    res.json({
      saved: false,
      result:
        "I was not able to save that callback request right now. Please ask the caller to try calling back shortly or visit the World Class Auto Detail website for more information."
    });
  }
});
