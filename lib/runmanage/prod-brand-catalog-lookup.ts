import { prisma } from "@/lib/prisma";
import type { ProdBrandCatalogSnap } from "@/lib/runmanage/run-brand-stamp";

export async function lookupProdBrandCatalog(
  brandId: string | null | undefined,
): Promise<ProdBrandCatalogSnap | null> {
  const id = brandId?.trim();
  if (!id) return null;
  const row = await prisma.brands.findUnique({
    where: { id },
    select: {
      name: true,
      logoUrl: true,
      websiteUrl: true,
      instagramHandle: true,
    },
  });
  if (!row) return null;
  return {
    name: row.name,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    instagramHandle: row.instagramHandle,
  };
}
