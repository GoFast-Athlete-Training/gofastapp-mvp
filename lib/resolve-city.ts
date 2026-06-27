import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { toCitySlug } from "@/lib/seriesSlug";

export type ResolvedCity = {
  cityId: string;
  citySlug: string;
  cityName: string;
};

/** Normalized slug from display city (+ optional state for alias table). */
export function resolveCitySlug(
  cityName?: string | null,
  _state?: string | null
): string | null {
  const slug = toCitySlug(cityName);
  if (!slug || slug === "unknown") return null;
  return slug;
}

type CityDb = Pick<PrismaClient, "cities">;

/** Lookup or create `cities` row — server-only; staff never set cityId. */
export async function findOrCreateCityBySlug(
  citySlug: string,
  cityName?: string | null,
  db: CityDb = defaultPrisma
): Promise<ResolvedCity | null> {
  const normalized = citySlug.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return null;

  let city = await db.cities.findFirst({
    where: { slug: { equals: normalized, mode: "insensitive" } },
  });
  if (!city) {
    city = await db.cities.create({
      data: {
        id: normalized,
        name: cityName?.trim() || normalized,
        slug: normalized,
        updatedAt: new Date(),
      },
    });
  }

  return {
    cityId: city.id,
    citySlug: city.slug,
    cityName: city.name,
  };
}

/** meetUpCity / HQ city → slug → cities row. */
export async function resolveCityFromMeetUp(
  opts: {
    meetUpCity?: string | null;
    meetUpState?: string | null;
  },
  db: CityDb = defaultPrisma
): Promise<ResolvedCity | null> {
  const citySlug = resolveCitySlug(opts.meetUpCity, opts.meetUpState);
  if (!citySlug) return null;
  return findOrCreateCityBySlug(citySlug, opts.meetUpCity, db);
}

export type CityFields = {
  citySlug: string | null;
  cityId: string | null;
};

/** Empty city fields when meet-up city cannot be resolved. */
export const EMPTY_CITY_FIELDS: CityFields = { citySlug: null, cityId: null };

export async function resolveCityFieldsFromMeetUp(
  opts: {
    meetUpCity?: string | null;
    meetUpState?: string | null;
  },
  db: CityDb = defaultPrisma
): Promise<CityFields> {
  const resolved = await resolveCityFromMeetUp(opts, db);
  if (!resolved) return EMPTY_CITY_FIELDS;
  return { citySlug: resolved.citySlug, cityId: resolved.cityId };
}
