"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOwnedLocation, requireLiveAdminAccountId } from "@/lib/admin-auth";
import { getBackendAdminHeaders, getBackendUrl, hasBackendEnv, hasSupabaseAuthEnv } from "@/lib/env";
import { createServiceSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalTimeSchema = z.union([timeSchema, z.literal("")]).transform((value) => value || null);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bookingStatusSchema = z.enum(["confirmed", "cancelled", "completed", "no_show"]);
const calendarIdSchema = z.string().trim().min(1).max(1024).regex(/^[^\r\n]+$/);

const bookingStatusFormSchema = z.object({
  bookingId: uuidSchema,
  status: bookingStatusSchema,
});

const locationSettingsFormSchema = z.object({
  locationId: uuidSchema,
  sameDayCutoff: optionalTimeSchema,
  hours: z
    .array(
      z
        .object({
          day: z.number().int().min(0).max(6),
          isClosed: z.boolean(),
          openTime: optionalTimeSchema,
          closeTime: optionalTimeSchema,
        })
        .superRefine((value, ctx) => {
          if (value.isClosed) {
            return;
          }

          if (!value.openTime || !value.closeTime) {
            ctx.addIssue({
              code: "custom",
              message: "Open and close times are required unless the day is closed.",
            });
            return;
          }

          if (value.openTime >= value.closeTime) {
            ctx.addIssue({
              code: "custom",
              message: "Open time must be before close time.",
            });
          }
        }),
    )
    .length(7),
});

const overrideFormSchema = z
  .object({
    locationId: uuidSchema,
    overrideDate: dateOnlySchema,
    isClosed: z.boolean(),
    openTime: optionalTimeSchema,
    closeTime: optionalTimeSchema,
    reason: z.string().trim().max(500).transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    if (value.isClosed) {
      return;
    }

    if (!value.openTime || !value.closeTime) {
      ctx.addIssue({
        code: "custom",
        message: "Open and close times are required unless the override is closed.",
      });
      return;
    }

    if (value.openTime >= value.closeTime) {
      ctx.addIssue({
        code: "custom",
        message: "Override open time must be before close time.",
      });
    }
  });

const deleteOverrideFormSchema = z.object({
  locationId: uuidSchema,
  overrideDate: dateOnlySchema,
});

const googleMappingFormSchema = z.object({
  mainCalendarId: calendarIdSchema,
  pikesvilleCalendarId: calendarIdSchema,
  towsonCalendarId: calendarIdSchema,
  mobileCalendarId: calendarIdSchema,
});

const googleAuthUrlResponseSchema = z.object({
  url: z.string().url(),
});

function parseRequiredForm<T>(schema: z.ZodType<T>, value: unknown, redirectPath: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    redirect(`${redirectPath}?saved=invalid`);
  }

  return parsed.data;
}

export async function signOutAction() {
  if (hasSupabaseAuthEnv()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}

export async function updateBookingStatusAction(formData: FormData) {
  const accountId = await requireLiveAdminAccountId("/dashboard/bookings");
  const parsed = parseRequiredForm(
    bookingStatusFormSchema,
    {
      bookingId: String(formData.get("bookingId") ?? ""),
      status: String(formData.get("status") ?? ""),
    },
    "/dashboard/bookings",
  );

  const supabase = createServiceSupabaseClient();
  await supabase.from("bookings").update({ status: parsed.status }).eq("id", parsed.bookingId).eq("account_id", accountId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings?saved=status");
}

export async function updateLocationSettingsAction(formData: FormData) {
  const accountId = await requireLiveAdminAccountId("/dashboard/schedule");
  const parsed = parseRequiredForm(
    locationSettingsFormSchema,
    {
      locationId: String(formData.get("locationId") ?? ""),
      sameDayCutoff: String(formData.get("sameDayCutoff") ?? ""),
      hours: Array.from({ length: 7 }, (_, day) => ({
        day,
        isClosed: formData.get(`closed-${day}`) === "on",
        openTime: String(formData.get(`open-${day}`) ?? ""),
        closeTime: String(formData.get(`close-${day}`) ?? ""),
      })),
    },
    "/dashboard/schedule",
  );
  const supabase = createServiceSupabaseClient();
  await assertOwnedLocation(parsed.locationId, accountId, "/dashboard/schedule");

  await supabase
    .from("locations")
    .update({ same_day_cutoff_time: parsed.sameDayCutoff })
    .eq("id", parsed.locationId)
    .eq("account_id", accountId);

  for (const hour of parsed.hours) {
    await supabase
      .from("location_hours")
      .upsert(
        {
          location_id: parsed.locationId,
          day_of_week: hour.day,
          is_closed: hour.isClosed,
          open_time: hour.isClosed ? null : hour.openTime,
          close_time: hour.isClosed ? null : hour.closeTime,
        },
        { onConflict: "location_id,day_of_week" },
      );
  }

  revalidatePath("/dashboard/schedule");
  redirect("/dashboard/schedule?saved=hours");
}

export async function createOverrideAction(formData: FormData) {
  const accountId = await requireLiveAdminAccountId("/dashboard/schedule");
  const parsed = parseRequiredForm(
    overrideFormSchema,
    {
      locationId: String(formData.get("locationId") ?? ""),
      overrideDate: String(formData.get("overrideDate") ?? ""),
      isClosed: formData.get("overrideClosed") === "on",
      openTime: String(formData.get("overrideOpen") ?? ""),
      closeTime: String(formData.get("overrideClose") ?? ""),
      reason: String(formData.get("overrideReason") ?? ""),
    },
    "/dashboard/schedule",
  );

  const supabase = createServiceSupabaseClient();
  await assertOwnedLocation(parsed.locationId, accountId, "/dashboard/schedule");

  await supabase
    .from("location_overrides")
    .upsert(
      {
        location_id: parsed.locationId,
        override_date: parsed.overrideDate,
        is_closed: parsed.isClosed,
        open_time: parsed.isClosed ? null : parsed.openTime,
        close_time: parsed.isClosed ? null : parsed.closeTime,
        reason: parsed.reason,
      },
      { onConflict: "location_id,override_date" },
    );

  revalidatePath("/dashboard/schedule");
  redirect("/dashboard/schedule?saved=override");
}

export async function deleteOverrideAction(formData: FormData) {
  const accountId = await requireLiveAdminAccountId("/dashboard/schedule");
  const parsed = parseRequiredForm(
    deleteOverrideFormSchema,
    {
      locationId: String(formData.get("locationId") ?? ""),
      overrideDate: String(formData.get("overrideDate") ?? ""),
    },
    "/dashboard/schedule",
  );

  const supabase = createServiceSupabaseClient();
  await assertOwnedLocation(parsed.locationId, accountId, "/dashboard/schedule");
  await supabase
    .from("location_overrides")
    .delete()
    .eq("location_id", parsed.locationId)
    .eq("override_date", parsed.overrideDate);

  revalidatePath("/dashboard/schedule");
  redirect("/dashboard/schedule?saved=override-removed");
}

export async function saveGoogleMappingAction(formData: FormData) {
  const accountId = await requireLiveAdminAccountId("/dashboard/settings");
  if (!hasBackendEnv()) {
    redirect("/dashboard/settings?saved=config-error");
  }

  const parsed = parseRequiredForm(
    googleMappingFormSchema,
    {
      mainCalendarId: String(formData.get("mainCalendarId") ?? ""),
      pikesvilleCalendarId: String(formData.get("pikesvilleCalendarId") ?? ""),
      towsonCalendarId: String(formData.get("towsonCalendarId") ?? ""),
      mobileCalendarId: String(formData.get("mobileCalendarId") ?? ""),
    },
    "/dashboard/settings",
  );
  const backendUrl = getBackendUrl()!;
  const backendHeaders = getBackendAdminHeaders();
  if (!backendHeaders) {
    redirect("/dashboard/settings?saved=config-error");
  }

  await fetch(`${backendUrl}/api/google/mapping`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...backendHeaders,
    },
    body: JSON.stringify({
      accountId,
      mainCalendarId: parsed.mainCalendarId,
      locations: {
        pikesville: parsed.pikesvilleCalendarId,
        towson: parsed.towsonCalendarId,
        mobile: parsed.mobileCalendarId,
      },
    }),
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=mapping");
}

export async function connectGoogleAction() {
  const accountId = await requireLiveAdminAccountId("/dashboard/settings");
  if (!hasBackendEnv()) {
    redirect("/dashboard/settings?saved=config-error");
  }

  const backendUrl = getBackendUrl()!;
  const backendHeaders = getBackendAdminHeaders();
  if (!backendHeaders) {
    redirect("/dashboard/settings?saved=config-error");
  }

  const response = await fetch(`${backendUrl}/api/auth/google/url?accountId=${encodeURIComponent(accountId)}`, {
    cache: "no-store",
    headers: backendHeaders,
  });

  if (!response.ok) {
    redirect("/dashboard/settings?saved=google-error");
  }

  const parsed = googleAuthUrlResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    redirect("/dashboard/settings?saved=google-error");
  }

  redirect(parsed.data.url);
}

export async function disconnectGoogleAction() {
  const accountId = await requireLiveAdminAccountId("/dashboard/settings");
  if (!hasBackendEnv()) {
    redirect("/dashboard/settings?saved=config-error");
  }

  const backendUrl = getBackendUrl()!;
  const backendHeaders = getBackendAdminHeaders();
  if (!backendHeaders) {
    redirect("/dashboard/settings?saved=config-error");
  }

  await fetch(`${backendUrl}/api/google/connection?accountId=${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    headers: backendHeaders,
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=disconnect");
}
