import type { NextFunction, Request, Response } from "express";
import { requireEnv } from "../lib/env.js";

export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const expectedApiKey = requireEnv("BELLA_API_KEY");
  const apiKey = req.headers["x-api-key"];

  if (typeof apiKey !== "string" || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

