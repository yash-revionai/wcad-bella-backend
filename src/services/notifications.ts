import { DateTime } from "luxon";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { formatPhoneForDisplay } from "../lib/phone.js";

const businessPhoneDisplay = "(443) 957-4789";
const businessPhoneSms = "443-957-4789";
const businessZone = "America/New_York";
const notificationTimeoutMs = 5_000;

export type ConfirmationDetails = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceName: string;
  vehicleType: string;
  locationName: string;
  locationAddress: string | null;
  appointmentStartIso: string;
};

function formatAppointment(details: ConfirmationDetails) {
  return DateTime.fromISO(details.appointmentStartIso, { zone: businessZone }).toFormat("cccc, LLLL d 'at' h:mm a");
}

function titleCaseVehicleType(vehicleType: string) {
  return vehicleType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildEmailConfirmation(details: ConfirmationDetails) {
  const lines = [
    `Hi ${details.customerName},`,
    "",
    "Your appointment has been confirmed!",
    "",
    `Service: ${details.serviceName}`,
    `Vehicle: ${titleCaseVehicleType(details.vehicleType)}`,
    `Location: ${details.locationName}${details.locationAddress ? ` — ${details.locationAddress}` : ""}`,
    `Date & Time: ${formatAppointment(details)}`,
    "",
    "Please note:",
    "- A credit card is required to hold your appointment. You will not be charged until after the service is complete.",
    "- Appointment requires 24 hours notice to cancel or reschedule.",
    "- Please empty your vehicle before arrival for best results."
  ];

  if (details.locationName.toLowerCase().includes("towson")) {
    lines.push("- Parking is fully covered. Take a ticket on entry, give it to our staff, and we will stamp it for free exit.");
  }

  if (details.locationName.toLowerCase().includes("mobile")) {
    lines.push("- Our team will arrive fully equipped. Please ensure a driveway or parking lot is available.");
  }

  lines.push("", `Questions? Call us at ${businessPhoneDisplay}.`, "", "Thank you for choosing World Class Auto Detail!");

  return {
    subject: "Your World Class Auto Detail Appointment is Confirmed",
    html: lines.map((line) => (line === "" ? "<br />" : `${line}<br />`)).join("")
  };
}

export function buildSmsConfirmation(details: ConfirmationDetails) {
  return `WCAD Appointment Confirmed! ${details.serviceName} for your ${titleCaseVehicleType(details.vehicleType)} at ${details.locationName} on ${formatAppointment(details)}. Questions? Call ${businessPhoneSms}. Reply STOP to opt out.`;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const signal = AbortSignal.timeout(notificationTimeoutMs);
  return fetch(url, {
    ...init,
    signal
  });
}

export async function sendEmailConfirmation(details: ConfirmationDetails) {
  if (!details.customerEmail) {
    return false;
  }

  if (!env.RESEND_API_KEY) {
    logger.warn({ email: details.customerEmail }, "Skipping email confirmation because RESEND_API_KEY is missing");
    return false;
  }

  const email = buildEmailConfirmation(details);
  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "World Class Auto Detail <appointments@worldclassautodetail.com>",
      to: [details.customerEmail],
      subject: email.subject,
      html: email.html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend request failed with ${response.status}: ${body}`);
  }

  return true;
}

export async function sendSmsConfirmation(details: ConfirmationDetails) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    logger.warn({ phone: formatPhoneForDisplay(details.customerPhone) }, "Skipping SMS confirmation because Twilio env vars are missing");
    return false;
  }

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({
    To: details.customerPhone,
    From: env.TWILIO_PHONE_NUMBER,
    Body: buildSmsConfirmation(details)
  });

  const response = await fetchWithTimeout(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twilio request failed with ${response.status}: ${body}`);
  }

  return true;
}

export async function sendDeveloperAlert(input: { subject: string; text: string }) {
  if (!env.RESEND_API_KEY || !env.DEVELOPER_ALERT_EMAIL) {
    logger.warn(
      { hasResendKey: Boolean(env.RESEND_API_KEY), hasDeveloperAlertEmail: Boolean(env.DEVELOPER_ALERT_EMAIL) },
      "Skipping developer alert because alert email configuration is missing"
    );
    return false;
  }

  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Bella Alerts <alerts@worldclassautodetail.com>",
      to: [env.DEVELOPER_ALERT_EMAIL],
      subject: input.subject,
      text: input.text
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend alert request failed with ${response.status}: ${body}`);
  }

  return true;
}
