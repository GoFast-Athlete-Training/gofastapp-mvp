import { prisma } from "@/lib/prisma";
import { parsePartnerExtras } from "@/lib/runmanage/partner-extras";
import {
  type CityRunAffiliationRefs,
  validateCityRunAffiliationShape,
} from "@/lib/city-run/run-affiliations";

type IdBucket = {
  label: string;
  ids: Set<string>;
  find: (ids: string[]) => Promise<{ id: string }[]>;
};

function add(bucket: IdBucket, value: unknown) {
  if (typeof value === "string" && value.trim()) bucket.ids.add(value.trim());
}

/**
 * Shape check plus an existence check for every referenced row, so a stale id
 * from staff create or Company sync returns a 400 naming the bad reference
 * instead of an opaque Prisma foreign-key 500.
 *
 * Returns null when the affiliations are writable.
 */
export async function validateCityRunAffiliationRefs(
  refs: CityRunAffiliationRefs,
  explicitType?: unknown
): Promise<string | null> {
  const shapeError = validateCityRunAffiliationShape(refs, explicitType);
  if (shapeError) return shapeError;

  const buckets: Record<"race" | "event" | "store" | "club" | "crew" | "brand", IdBucket> = {
    race: {
      label: "raceRegistryId",
      ids: new Set(),
      find: (ids) => prisma.race_registry.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    },
    event: {
      label: "specialEventId",
      ids: new Set(),
      find: (ids) => prisma.special_events.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    },
    store: {
      label: "runStoreId",
      ids: new Set(),
      find: (ids) => prisma.run_stores.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    },
    club: {
      label: "runClubId",
      ids: new Set(),
      find: (ids) => prisma.run_clubs.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    },
    crew: {
      label: "runCrewId",
      ids: new Set(),
      find: (ids) => prisma.run_crews.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    },
    brand: {
      label: "runBrandId",
      ids: new Set(),
      find: (ids) => prisma.brands.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    },
  };

  add(buckets.race, refs.raceRegistryId);
  add(buckets.event, refs.specialEventId);
  add(buckets.store, refs.runStoreId);
  add(buckets.club, refs.runClubId);
  add(buckets.crew, refs.runCrewId);
  add(buckets.brand, refs.runBrandId);

  for (const extra of parsePartnerExtras(refs.partnerExtras)) {
    if (extra.kind === "CLUB") add(buckets.club, extra.refId);
    else if (extra.kind === "STORE") add(buckets.store, extra.refId);
    else add(buckets.brand, extra.refId);
  }

  const pending = Object.values(buckets).filter((bucket) => bucket.ids.size > 0);
  const found = await Promise.all(pending.map((bucket) => bucket.find([...bucket.ids])));

  for (const [index, bucket] of pending.entries()) {
    const present = new Set(found[index].map((row) => row.id));
    const missing = [...bucket.ids].filter((id) => !present.has(id));
    if (missing.length > 0) {
      return `${bucket.label} not found: ${missing.join(", ")}`;
    }
  }
  return null;
}
