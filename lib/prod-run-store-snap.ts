import { prisma } from "@/lib/prisma";
import { isStoreTypeValue, type StoreTypeValue } from "@/lib/store-type";

function coerceStoreType(v: unknown): StoreTypeValue {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (isStoreTypeValue(s)) return s;
  if (s === "COFFEE" || s === "BAGELS" || s === "FOOD") return "FOOD_STORE";
  if (s === "OTHER") return "RUN_STORE";
  return "RUN_STORE";
}

export type ProdRunStoreSnapInput = {
  storeId?: string;
  gofastCompanyId?: string;
  slug?: string;
  name?: string;
  storeType?: string | null;
  whatItSells?: string | null;
  runningTieIn?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  streetAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  brandId?: string | null;
};

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "store"
  );
}

export async function upsertProdRunStoreSnap(s: ProdRunStoreSnapInput) {
  const id = s.storeId?.trim();
  const name = s.name?.trim();
  if (!id || !name) {
    return {
      ok: false as const,
      status: 400,
      error: "store.storeId and store.name are required",
    };
  }

  const slugRaw = s.slug?.trim().toLowerCase() || slugify(name);
  const slug = slugRaw.slice(0, 64);
  const storeType = coerceStoreType(s.storeType);
  const now = new Date();

  const slugTaken = await prisma.run_stores.findFirst({
    where: { slug, NOT: { id } },
    select: { id: true },
  });
  if (slugTaken) {
    return {
      ok: false as const,
      status: 409,
      error: `Slug "${slug}" is already used by another store`,
    };
  }

  const brandId = s.brandId?.trim() || null;
  if (brandId) {
    const brand = await prisma.brands.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) {
      return { ok: false as const, status: 400, error: "brandId not found on prod" };
    }
  }

  const instagramHandle = s.instagramHandle?.trim().replace(/^@+/, "") || null;

  const store = await prisma.run_stores.upsert({
    where: { id },
    create: {
      id,
      brandId,
      slug,
      name,
      storeType,
      whatItSells: s.whatItSells?.trim() || null,
      runningTieIn: s.runningTieIn?.trim() || null,
      websiteUrl: s.websiteUrl?.trim() || null,
      instagramHandle,
      logoUrl: s.logoUrl?.trim() || null,
      contactEmail: s.contactEmail?.trim() || null,
      contactPhone: s.contactPhone?.trim() || null,
      formattedAddress: s.formattedAddress?.trim() || null,
      placeId: s.placeId?.trim() || null,
      streetAddress: s.streetAddress?.trim() || null,
      lat: typeof s.lat === "number" && Number.isFinite(s.lat) ? s.lat : null,
      lng: typeof s.lng === "number" && Number.isFinite(s.lng) ? s.lng : null,
      zipCode: s.zipCode?.trim() || null,
      city: s.city?.trim() || null,
      state: s.state?.trim() || null,
      syncedAt: now,
      updatedAt: now,
    },
    update: {
      brandId,
      slug,
      name,
      storeType,
      whatItSells: s.whatItSells?.trim() || null,
      runningTieIn: s.runningTieIn?.trim() || null,
      websiteUrl: s.websiteUrl?.trim() || null,
      instagramHandle,
      logoUrl: s.logoUrl?.trim() || null,
      contactEmail: s.contactEmail?.trim() || null,
      contactPhone: s.contactPhone?.trim() || null,
      formattedAddress: s.formattedAddress?.trim() || null,
      placeId: s.placeId?.trim() || null,
      streetAddress: s.streetAddress?.trim() || null,
      lat: typeof s.lat === "number" && Number.isFinite(s.lat) ? s.lat : null,
      lng: typeof s.lng === "number" && Number.isFinite(s.lng) ? s.lng : null,
      zipCode: s.zipCode?.trim() || null,
      city: s.city?.trim() || null,
      state: s.state?.trim() || null,
      syncedAt: now,
      updatedAt: now,
    },
  });

  return { ok: true as const, store };
}
