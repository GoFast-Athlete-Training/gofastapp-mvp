import { prisma } from "@/lib/prisma";

const BRAND_TYPES = [
  "SHOE",
  "APPAREL",
  "NUTRITION",
  "PERFORMANCE",
  "RUN_STORE_CHAIN",
  "GEAR",
  "OTHER",
] as const;

function parseBrandType(v: unknown): (typeof BRAND_TYPES)[number] {
  if (typeof v === "string" && BRAND_TYPES.includes(v as (typeof BRAND_TYPES)[number])) {
    return v as (typeof BRAND_TYPES)[number];
  }
  return "OTHER";
}

export type ProdBrandSnapInput = {
  brandId?: string;
  slug?: string;
  name?: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  brandType?: string | null;
  instagramHandle?: string | null;
  city?: string | null;
  state?: string | null;
  yearFounded?: number | null;
  otherLocations?: unknown;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export async function upsertProdBrandSnap(b: ProdBrandSnapInput) {
  const brandId = b.brandId?.trim();
  const slug = b.slug?.trim().toLowerCase();
  const name = b.name?.trim();

  if (!brandId || !slug || !name) {
    return { ok: false as const, status: 400, error: "brand.brandId, brand.slug, and brand.name are required" };
  }

  const now = new Date();
  const brandType = parseBrandType(b.brandType);
  const description = b.description?.trim() || null;
  const websiteUrl = b.websiteUrl?.trim() || null;
  const logoUrl = b.logoUrl?.trim() || null;
  const instagramHandle = b.instagramHandle?.trim().replace(/^@+/, "") || null;
  const city = b.city?.trim() || null;
  const state = b.state?.trim() || null;
  const yearFounded =
    typeof b.yearFounded === "number" && Number.isInteger(b.yearFounded) ? b.yearFounded : null;
  const contactEmail = b.contactEmail?.trim() || null;
  const contactPhone = b.contactPhone?.trim() || null;
  const otherLocations = Array.isArray(b.otherLocations) ? b.otherLocations : [];

  const slugTaken = await prisma.brands.findUnique({ where: { slug } });
  const slugUpdate = !slugTaken || slugTaken.id === brandId ? slug : undefined;

  const brand = await prisma.brands.upsert({
    where: { id: brandId },
    create: {
      id: brandId,
      slug,
      name,
      brandType,
      description,
      websiteUrl,
      instagramHandle,
      logoUrl,
      city,
      state,
      yearFounded,
      otherLocations,
      contactEmail,
      contactPhone,
      syncedAt: now,
      updatedAt: now,
    },
    update: {
      name,
      brandType,
      description,
      websiteUrl,
      instagramHandle,
      logoUrl,
      city,
      state,
      yearFounded,
      otherLocations,
      contactEmail,
      contactPhone,
      syncedAt: now,
      updatedAt: now,
      ...(slugUpdate ? { slug: slugUpdate } : {}),
    },
  });

  return { ok: true as const, brand };
}

const prodBrandReadSelect = {
  id: true,
  slug: true,
  name: true,
  brandType: true,
  description: true,
  websiteUrl: true,
  instagramHandle: true,
  logoUrl: true,
  city: true,
  state: true,
  yearFounded: true,
  otherLocations: true,
  contactEmail: true,
  contactPhone: true,
  syncedAt: true,
  updatedAt: true,
} as const;

export async function listProdBrandsForReconcile(since?: Date) {
  return prisma.brands.findMany({
    where: since ? { updatedAt: { gte: since } } : undefined,
    select: prodBrandReadSelect,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProdBrandSnapById(brandId: string) {
  const id = brandId.trim();
  if (!id) {
    return { ok: false as const, status: 400, error: "brandId required" };
  }

  const brand = await prisma.brands.findUnique({
    where: { id },
    select: prodBrandReadSelect,
  });

  if (!brand) {
    return { ok: true as const, exists: false as const, brand: null };
  }

  return { ok: true as const, exists: true as const, brand };
}
