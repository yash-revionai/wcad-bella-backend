export const businessTimeZone = "Asia/Kolkata";

const businessOffset = "+05:30";

function partsForDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function toDateOnly({ year, month, day }: { year: number; month: number; day: number }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function businessDateOnly(date = new Date()) {
  return toDateOnly(partsForDate(date));
}

export function businessDayRangeIso(date = new Date()) {
  const day = businessDateOnly(date);
  return {
    start: `${day}T00:00:00.000${businessOffset}`,
    end: `${day}T23:59:59.999${businessOffset}`,
  };
}

export function businessWeekRangeIso(date = new Date()) {
  const today = businessDateOnly(date);
  const [year, month, day] = today.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = addDays(today, -daysSinceMonday);
  const sunday = addDays(monday, 6);

  return {
    start: `${monday}T00:00:00.000${businessOffset}`,
    end: `${sunday}T23:59:59.999${businessOffset}`,
  };
}

export function formatTimeInBusinessZone(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatWeekdayTimeInBusinessZone(value: string) {
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    weekday: "short",
  }).format(date);

  return `${weekday.toUpperCase()} - ${formatTimeInBusinessZone(value)}`;
}

export function isTodayInBusinessZone(value: string) {
  return businessDateOnly(new Date(value)) === businessDateOnly();
}

export function formatMonthDayInBusinessZone(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    month: "short",
    day: "2-digit",
  })
    .format(new Date(`${value}T00:00:00${businessOffset}`))
    .toUpperCase();
}

export function formatCurrentDateLabelInBusinessZone() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase()
    .replace(/,/g, "");
}
