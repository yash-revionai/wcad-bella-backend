import { Router } from "express";
import { z } from "zod";
import { validateApiKey } from "../middleware/auth.js";

export const transferRouter = Router();

const PRIMARY_NUMBER = "+14439574789";
const SECONDARY_NUMBER = "+14434633533";

const schema = z.object({
  reason: z.string().optional(),
  attempt: z.string().optional()
});

transferRouter.post("/", validateApiKey, async (req, res, next) => {
  try {
    const { attempt } = schema.parse(req.body);

    if (!attempt || attempt === "primary") {
      res.json({
        result: "I can connect you with our team now. Please hold for just a moment.",
        transferTo: PRIMARY_NUMBER,
        agentReaction: "transfer-call"
      });
      return;
    }

    if (attempt === "secondary") {
      res.json({
        result: "Let me try one more line for you. Please hold.",
        transferTo: SECONDARY_NUMBER,
        agentReaction: "transfer-call"
      });
      return;
    }

    // Both transfers failed — ask Bella to collect callback details
    res.json({
      result: "I wasn't able to connect you with a team member right now. Can I get your name, phone number, a brief reason for your call, and the best time for us to reach you back?",
      transferTo: null,
      agentReaction: "speaks-once"
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.json({
        result: "I can help connect you with our team now. Please hold for just a moment.",
        transferTo: PRIMARY_NUMBER,
        agentReaction: "transfer-call"
      });
      return;
    }

    next(error);
  }
});
