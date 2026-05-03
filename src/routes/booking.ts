import { Router } from "express";
import { z } from "zod";
import { locationSlugs, serviceSlugs, vehicleTypes } from "../config/constants.js";
import { normalizeUsPhoneNumber } from "../lib/phone.js";
import { validateApiKey } from "../middleware/auth.js";
import { confirmBooking } from "../services/booking.js";

export const bookingRouter = Router();

function isIsoDateTime(value: string) {
  return value.includes("T");
}

function isValidUsPhoneNumber(value: string) {
  try {
    normalizeUsPhoneNumber(value);
    return true;
  } catch {
    return false;
  }
}

const bookingRequestSchema = z.object({
  accountId: z.string().uuid().optional(),
  callerName: z.string().trim().min(1).max(200),
  callerPhone: z
    .string()
    .trim()
    .refine(isValidUsPhoneNumber, "Caller phone must be a valid US phone number."),
  callerEmail: z.string().email().optional().nullable(),
  service: z.enum(serviceSlugs),
  vehicleType: z.enum(vehicleTypes),
  location: z.enum(locationSlugs),
  appointmentStart: z
    .string()
    .trim()
    .refine(isIsoDateTime, "Appointment start must be a valid ISO 8601 datetime."),
  notes: z.string().trim().max(2000).optional().nullable()
}).strict();

bookingRouter.post("/", validateApiKey, async (req, res, next) => {
  try {
    const parsed = bookingRequestSchema.parse(req.body);
    const response = await confirmBooking(parsed);
    res.json(response);
  } catch (error) {
    next(error);
  }
});
