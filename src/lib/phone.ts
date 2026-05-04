import { AppError } from "./errors.js";

export function normalizeUsPhoneNumber(value: string) {
  const trimmed = value.trim();
  const digits = value.replace(/\D/g, "");
  const nanpLocalPattern = /^[2-9]\d{2}[2-9]\d{6}$/;

  if (trimmed.startsWith("+")) {
    if (/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(trimmed.replace(/[\s().-]/g, ""))) {
      return `+${digits}`;
    }

    throw new AppError("Phone number must be a valid 10-digit US or Canada number.", 400);
  }

  if (digits.length === 10 && nanpLocalPattern.test(digits)) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1") && nanpLocalPattern.test(digits.slice(1))) {
    return `+${digits}`;
  }

  throw new AppError("Phone number must be a valid 10-digit US or Canada number.", 400);
}

export function formatPhoneForDisplay(value: string) {
  const normalized = normalizeUsPhoneNumber(value);
  return `${normalized.slice(0, 2)} (${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8)}`;
}
