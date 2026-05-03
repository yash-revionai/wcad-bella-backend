"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getBackendUrl, hasBackendEnv, hasSupabaseAuthEnv, hasSupabaseServiceEnv } from "@/lib/env";

export async function signOutAction() {
  if (hasSupabaseAuthEnv()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}

export async function updateBookingStatusAction(formData: FormData) {
  if (!hasSupabaseServiceEnv()) {
    redirect("/dashboard/bookings?saved=demo");
  }

  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "");

  const supabase = createServiceSupabaseClient();
  await supabase.from("bookings").update({ status }).eq("id", bookingId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  redirect("/dashboard/bookings?saved=status");
}

export async function updateLocationSettingsAction(formData: FormData) {
  if (!hasSupabaseServiceEnv()) {
    redirect("/dashboard/schedule?saved=demo");
  }

  const locationId = String(formData.get("locationId") ?? "");
  const cutoffRaw = String(formData.get("sameDayCutoff") ?? "");
  const supabase = createServiceSupabaseClient();

  await supabase
    .from("locations")
    .update({ same_day_cutoff_time: cutoffRaw || null })
    .eq("id", locationId);

  const weekdayOpen = String(formData.get("open-1") ?? "");
  const weekdayClose = String(formData.get("close-1") ?? "");

  for (let day = 0; day < 7; day += 1) {
    const isClosed = formData.get(`closed-${day}`) === "on";
    const open = String(formData.get(`open-${day}`) ?? (day >= 2 && day <= 5 ? weekdayOpen : ""));
    const close = String(formData.get(`close-${day}`) ?? (day >= 2 && day <= 5 ? weekdayClose : ""));

    await supabase
      .from("location_hours")
      .upsert(
        {
          location_id: locationId,
          day_of_week: day,
          is_closed: isClosed,
          open_time: isClosed ? null : open || null,
          close_time: isClosed ? null : close || null,
        },
        { onConflict: "location_id,day_of_week" },
      );
  }

  revalidatePath("/dashboard/schedule");
  redirect("/dashboard/schedule?saved=hours");
}

export async function createOverrideAction(formData: FormData) {
  if (!hasSupabaseServiceEnv()) {
    redirect("/dashboard/schedule?saved=demo");
  }

  const locationId = String(formData.get("locationId") ?? "");
  const overrideDate = String(formData.get("overrideDate") ?? "");
  const isClosed = formData.get("overrideClosed") === "on";
  const openTime = String(formData.get("overrideOpen") ?? "");
  const closeTime = String(formData.get("overrideClose") ?? "");
  const reason = String(formData.get("overrideReason") ?? "");

  const supabase = createServiceSupabaseClient();
  await supabase
    .from("location_overrides")
    .upsert(
      {
        location_id: locationId,
        override_date: overrideDate,
        is_closed: isClosed,
        open_time: isClosed ? null : openTime || null,
        close_time: isClosed ? null : closeTime || null,
        reason: reason || null,
      },
      { onConflict: "location_id,override_date" },
    );

  revalidatePath("/dashboard/schedule");
  redirect("/dashboard/schedule?saved=override");
}

export async function saveGoogleMappingAction(formData: FormData) {
  if (!hasBackendEnv()) {
    redirect("/dashboard/settings?saved=demo");
  }

  const backendUrl = getBackendUrl()!;
  await fetch(`${backendUrl}/api/google/mapping`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mainCalendarId: String(formData.get("mainCalendarId") ?? ""),
      locations: {
        pikesville: String(formData.get("pikesvilleCalendarId") ?? ""),
        towson: String(formData.get("towsonCalendarId") ?? ""),
        mobile: String(formData.get("mobileCalendarId") ?? ""),
      },
    }),
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=mapping");
}

export async function disconnectGoogleAction() {
  if (!hasBackendEnv()) {
    redirect("/dashboard/settings?saved=demo");
  }

  const backendUrl = getBackendUrl()!;
  await fetch(`${backendUrl}/api/google/connection`, {
    method: "DELETE",
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=disconnect");
}
