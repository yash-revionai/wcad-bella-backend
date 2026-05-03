import { format, isToday, parseISO } from "date-fns";

export function formatAppointment(value: string) {
  const date = parseISO(value);
  return format(date, "EEE, MMM d • h:mm a");
}

export function formatTimeRange(start: string, end: string) {
  return `${format(parseISO(start), "h:mm a")} to ${format(parseISO(end), "h:mm a")}`;
}

export function formatDashboardDate(value: string) {
  const date = parseISO(value);
  return isToday(date) ? `Today • ${format(date, "h:mm a")}` : format(date, "EEE • h:mm a");
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
