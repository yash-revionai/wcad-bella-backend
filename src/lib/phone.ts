import { AppError } from "./errors.js";

export function normalizeUsPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  throw new AppError("Phone number must be a valid US number.", 400);
}

export function formatPhoneForDisplay(value: string) {
  const normalized = normalizeUsPhoneNumber(value);
  return `${normalized.slice(0, 2)} (${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8)}`;
}
