export const STORE_TYPES = ["RUN_STORE", "FOOD_STORE", "BIG_BRAND_STORE"] as const;
export type StoreTypeValue = (typeof STORE_TYPES)[number];

export function isStoreTypeValue(v: unknown): v is StoreTypeValue {
  return typeof v === "string" && (STORE_TYPES as readonly string[]).includes(v);
}

/** CSV meetupPointType — PLACE means text-only meet-up, no store catalog search. */
export const MEETUP_POINT_TYPES = [...STORE_TYPES, "PLACE"] as const;
export type MeetupPointTypeValue = (typeof MEETUP_POINT_TYPES)[number];

const LEGACY_MEETUP_MAP: Record<string, StoreTypeValue | "PLACE"> = {
  PLACE: "PLACE",
  RUN_STORE: "RUN_STORE",
  FOOD_STORE: "FOOD_STORE",
  BIG_BRAND_STORE: "BIG_BRAND_STORE",
  COFFEE: "FOOD_STORE",
  BAGELS: "FOOD_STORE",
  FOOD: "FOOD_STORE",
  OTHER: "RUN_STORE",
};

export function parseMeetupPointType(raw: unknown): StoreTypeValue | "PLACE" | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s) return "PLACE";
  const mapped = LEGACY_MEETUP_MAP[s];
  if (mapped) return mapped;
  return isStoreTypeValue(s) ? s : null;
}

export function storeTypeFromMeetupPointType(raw: unknown): StoreTypeValue | null {
  const parsed = parseMeetupPointType(raw);
  if (!parsed || parsed === "PLACE") return null;
  return parsed;
}

export function storeTypeLabel(t: StoreTypeValue): string {
  switch (t) {
    case "RUN_STORE":
      return "Run store";
    case "FOOD_STORE":
      return "Food & coffee";
    case "BIG_BRAND_STORE":
      return "Big brand shop";
    default:
      return t;
  }
}
