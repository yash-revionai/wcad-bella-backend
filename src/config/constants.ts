export const serviceSlugs = [
  "express_detail",
  "exterior_wax",
  "interior_deep",
  "complete_detail",
  "paint_correction",
  "ceramic_coating",
  "alacarte"
] as const;

export const vehicleTypes = ["sedan", "suv", "truck", "commercial"] as const;
export const locationSlugs = ["pikesville", "towson", "mobile"] as const;

export type ServiceSlug = (typeof serviceSlugs)[number];
export type VehicleType = (typeof vehicleTypes)[number];
export type LocationSlug = (typeof locationSlugs)[number];

