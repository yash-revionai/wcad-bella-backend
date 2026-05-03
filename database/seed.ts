import "dotenv/config";
import { createServiceSupabaseClient } from "../src/lib/supabase.js";

const accountEmail = "worldclassautodetail@gmail.com";

const locations = [
  {
    name: "World Class - Pikesville",
    slug: "pikesville",
    address: "1210 DeRisio Lane, Pikesville, MD 21208",
    google_calendar_id: null,
    capacity: 2,
    buffer_minutes: 15,
    same_day_cutoff_time: null,
    hours: {
      0: { is_closed: true },
      1: { open_time: "09:00", close_time: "17:00" },
      2: { open_time: "09:00", close_time: "17:00" },
      3: { open_time: "09:00", close_time: "17:00" },
      4: { open_time: "09:00", close_time: "17:00" },
      5: { open_time: "09:00", close_time: "17:00" },
      6: { open_time: "09:00", close_time: "17:00" }
    }
  },
  {
    name: "World Class - Towson",
    slug: "towson",
    address: "1 West Pennsylvania Ave, Towson Commons Garage Level 1A, Towson, MD 21204",
    google_calendar_id: null,
    capacity: 2,
    buffer_minutes: 15,
    same_day_cutoff_time: null,
    hours: {
      0: { is_closed: true },
      1: { open_time: "09:00", close_time: "17:00" },
      2: { open_time: "09:00", close_time: "17:00" },
      3: { open_time: "09:00", close_time: "17:00" },
      4: { open_time: "09:00", close_time: "17:00" },
      5: { open_time: "09:00", close_time: "17:00" },
      6: { open_time: "09:00", close_time: "17:00" }
    }
  },
  {
    name: "World Class - Mobile",
    slug: "mobile",
    address: "Mobile - serves 25-mile radius from Pikesville",
    google_calendar_id: null,
    capacity: 2,
    buffer_minutes: 30,
    same_day_cutoff_time: "14:00",
    hours: {
      0: { is_closed: true },
      1: { open_time: "09:00", close_time: "17:00" },
      2: { open_time: "09:00", close_time: "17:00" },
      3: { open_time: "09:00", close_time: "17:00" },
      4: { open_time: "09:00", close_time: "17:00" },
      5: { open_time: "09:00", close_time: "17:00" },
      6: { open_time: "09:00", close_time: "17:00" }
    }
  }
] as const;

const services = [
  { name: "Express Detail", slug: "express_detail", requires_staff_consult: false },
  { name: "Exterior Wax", slug: "exterior_wax", requires_staff_consult: false },
  { name: "Interior Deep Clean", slug: "interior_deep", requires_staff_consult: false },
  { name: "Complete Detail", slug: "complete_detail", requires_staff_consult: false },
  { name: "Paint Correction", slug: "paint_correction", requires_staff_consult: true },
  { name: "Ceramic Coating", slug: "ceramic_coating", requires_staff_consult: true },
  { name: "A La Carte", slug: "alacarte", requires_staff_consult: true }
] as const;

const durations = {
  express_detail: { sedan: 90, suv: 120, truck: 150, commercial: 180 },
  exterior_wax: { sedan: 150, suv: 180, truck: 180, commercial: 210 },
  interior_deep: { sedan: 150, suv: 180, truck: 180, commercial: 210 },
  complete_detail: { sedan: 210, suv: 240, truck: 270, commercial: 300 },
  paint_correction: { sedan: 300, suv: 300, truck: 420, commercial: 420 },
  ceramic_coating: { sedan: 480, suv: 480, truck: 480, commercial: 480 }
} as const;

const pricing = {
  express_detail: { sedan: 9900, suv: 10900, truck: 12900, commercial: 17500 },
  exterior_wax: { sedan: 18500, suv: 22500, truck: 27500, commercial: 37500 },
  interior_deep: { sedan: 18500, suv: 22500, truck: 27500, commercial: 30500 },
  complete_detail: { sedan: 30000, suv: 35000, truck: 39500, commercial: 47500 }
} as const;

const serviceLocations = {
  pikesville: ["express_detail", "exterior_wax", "interior_deep", "complete_detail", "paint_correction", "ceramic_coating", "alacarte"],
  towson: ["express_detail", "exterior_wax", "interior_deep", "complete_detail", "paint_correction", "ceramic_coating", "alacarte"],
  mobile: ["express_detail", "exterior_wax", "interior_deep", "complete_detail", "paint_correction", "alacarte"]
} as const;

type VehicleType = "sedan" | "suv" | "truck" | "commercial";

async function upsertOrThrow(
  promise: PromiseLike<{ data: unknown; error: Error | null }>,
  label: string
): Promise<any> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

async function main() {
  const supabase = createServiceSupabaseClient();

  const account = await upsertOrThrow(
    supabase
      .from("accounts")
      .upsert(
        {
          business_name: "World Class Auto Detail",
          email: accountEmail,
          phone_primary: "+14439574789",
          phone_secondary: "+14434633533"
        },
        { onConflict: "email" }
      )
      .select("id")
      .single(),
    "Upsert account"
  );

  const locationBySlug = new Map<string, string>();
  for (const location of locations) {
    const { hours, ...locationRow } = location;
    const savedLocation = await upsertOrThrow(
      supabase
        .from("locations")
        .upsert({ ...locationRow, account_id: account.id }, { onConflict: "account_id,slug" })
        .select("id, slug")
        .single(),
      `Upsert location ${location.slug}`
    );

    locationBySlug.set(savedLocation.slug, savedLocation.id);

    for (const [dayOfWeek, hourConfig] of Object.entries(hours)) {
      await upsertOrThrow(
        supabase.from("location_hours").upsert(
          {
            location_id: savedLocation.id,
            day_of_week: Number(dayOfWeek),
            open_time: "open_time" in hourConfig ? hourConfig.open_time : null,
            close_time: "close_time" in hourConfig ? hourConfig.close_time : null,
            is_closed: "is_closed" in hourConfig ? hourConfig.is_closed : false
          },
          { onConflict: "location_id,day_of_week" }
        ),
        `Upsert hours ${location.slug} day ${dayOfWeek}`
      );
    }
  }

  const serviceBySlug = new Map<string, string>();
  for (const service of services) {
    const savedService = await upsertOrThrow(
      supabase
        .from("services")
        .upsert({ ...service, account_id: account.id }, { onConflict: "account_id,slug" })
        .select("id, slug")
        .single(),
      `Upsert service ${service.slug}`
    );

    serviceBySlug.set(savedService.slug, savedService.id);
  }

  for (const [serviceSlug, durationByVehicle] of Object.entries(durations)) {
    const serviceId = serviceBySlug.get(serviceSlug);
    if (!serviceId) continue;

    for (const [vehicleType, durationMinutes] of Object.entries(durationByVehicle) as [VehicleType, number][]) {
      await upsertOrThrow(
        supabase.from("service_durations").upsert(
          {
            service_id: serviceId,
            vehicle_type: vehicleType,
            duration_minutes: durationMinutes
          },
          { onConflict: "service_id,vehicle_type" }
        ),
        `Upsert duration ${serviceSlug} ${vehicleType}`
      );
    }
  }

  for (const [serviceSlug, pricingByVehicle] of Object.entries(pricing)) {
    const serviceId = serviceBySlug.get(serviceSlug);
    if (!serviceId) continue;

    for (const [vehicleType, priceCents] of Object.entries(pricingByVehicle) as [VehicleType, number][]) {
      await upsertOrThrow(
        supabase.from("pricing").upsert(
          {
            service_id: serviceId,
            vehicle_type: vehicleType,
            price_cents: priceCents
          },
          { onConflict: "service_id,vehicle_type" }
        ),
        `Upsert pricing ${serviceSlug} ${vehicleType}`
      );
    }
  }

  for (const [locationSlug, serviceSlugList] of Object.entries(serviceLocations)) {
    const locationId = locationBySlug.get(locationSlug);
    if (!locationId) continue;

    for (const serviceSlug of serviceSlugList) {
      const serviceId = serviceBySlug.get(serviceSlug);
      if (!serviceId) continue;

      await upsertOrThrow(
        supabase.from("service_locations").upsert(
          {
            service_id: serviceId,
            location_id: locationId
          },
          { onConflict: "service_id,location_id" }
        ),
        `Upsert service location ${serviceSlug} ${locationSlug}`
      );
    }
  }

  await upsertOrThrow(
    supabase.from("admin_users").upsert(
      {
        account_id: account.id,
        email: accountEmail,
        role: "owner"
      },
      { onConflict: "email" }
    ),
    "Upsert admin user"
  );

  console.log("Seed complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
