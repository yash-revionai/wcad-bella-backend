import { businessTimeZone, formatTimeInBusinessZone, isTodayInBusinessZone } from "./timezone";

export function formatAppointment(value: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

  return formatted.replace(/, ([^,]+)$/, " • $1");
}

export function formatTimeRange(start: string, end: string) {
  return `${formatTimeInBusinessZone(start)} to ${formatTimeInBusinessZone(end)}`;
}

export function formatDashboardDate(value: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    weekday: "short",
  }).format(new Date(value));

  return isTodayInBusinessZone(value) ? `Today • ${formatTimeInBusinessZone(value)}` : `${weekday} • ${formatTimeInBusinessZone(value)}`;
}

export function formatCurrencyFromCents(cents: number | null) {
  if (cents === null) {
    return "Custom quote";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatVehicleLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function dayLabel(dayOfWeek: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek] ?? "";
}
