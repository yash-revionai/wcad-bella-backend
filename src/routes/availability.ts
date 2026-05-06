import { Router } from "express";
import { z } from "zod";
import { locationSlugs, serviceSlugs, vehicleTypes } from "../config/constants.js";
import { logger } from "../lib/logger.js";
import { validateApiKey } from "../middleware/auth.js";
import { checkAvailability } from "../services/availability.js";

export const availabilityRouter = Router();

function isIsoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const availabilityRequestSchema = z.object({
  service: z.enum(serviceSlugs),
  vehicleType: z.enum(vehicleTypes),
  location: z.enum(locationSlugs),
  preferredDate: z.string().trim().refine(isIsoDateOnly, "Preferred date must be in YYYY-MM-DD format.")
}).strict();

availabilityRouter.post("/", validateApiKey, async (req, res, next) => {
  res.set("X-Ultravox-Agent-Reaction", "speaks");

  try {
    const parsed = availabilityRequestSchema.parse(req.body);
    const response = await checkAvailability(parsed);
    res.json(response);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.json({
        result:
          "I did not get enough valid appointment details to check availability. Could I confirm the service, vehicle type, location, and date?",
        slots: [],
        agentReaction: "speaks"
      });
      return;
    }

    logger.error({ error }, "Availability check failed");
    res.json({
      result:
        "I'm having trouble checking availability right now. Could I take your name and number and have a team member call you back?",
      slots: [],
      agentReaction: "speaks"
    });
  }
});
