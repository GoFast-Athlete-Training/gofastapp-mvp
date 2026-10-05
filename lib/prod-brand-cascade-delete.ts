import { parsePartnerExtras, type PartnerExtra } from "@/lib/runmanage/partner-extras";
import { prisma } from "@/lib/prisma";

export type ProdBrandCascadeDeleteResult = {
  cityRunsCleared: number;
  partnerExtrasUpdated: number;
  brandRowDeleted: boolean;
};

function stripBrandFromPartnerExtras(raw: unknown, brandId: string): PartnerExtra[] | null {
  const parsed = parsePartnerExtras(raw);
  const next = parsed.filter((e) => !(e.kind === "BRAND" && e.refId === brandId));
  return next.length > 0 ? next : null;
}

/** Clear city run brand stamps and prod brands row for a deleted Sponsor Manage brand id. */
export async function cascadeDeleteProdBrand(brandId: string): Promise<ProdBrandCascadeDeleteResult> {
  const id = brandId.trim();
  if (!id) {
    return { cityRunsCleared: 0, partnerExtrasUpdated: 0, brandRowDeleted: false };
  }

  const cityRunsCleared = await prisma.city_runs.updateMany({
    where: { runBrandId: id },
    data: {
      runBrandId: null,
      runBrandName: null,
      runBrandLogoUrl: null,
      runBrandWebsiteUrl: null,
      runBrandInstagramHandle: null,
    },
  });

  let partnerExtrasUpdated = 0;
  const withExtras = await prisma.city_runs.findMany({
    where: { NOT: { partnerExtras: { equals: [] } } },
    select: { id: true, partnerExtras: true },
  });
  for (const row of withExtras) {
    const next = stripBrandFromPartnerExtras(row.partnerExtras, id);
    const hadBrand = parsePartnerExtras(row.partnerExtras).some(
      (e) => e.kind === "BRAND" && e.refId === id,
    );
    if (!hadBrand) continue;
    await prisma.city_runs.update({
      where: { id: row.id },
      data: { partnerExtras: next ?? [] },
    });
    partnerExtrasUpdated += 1;
  }

  const existing = await prisma.brands.findUnique({ where: { id }, select: { id: true } });
  if (existing) {
    await prisma.brands.delete({ where: { id } });
  }

  return {
    cityRunsCleared: cityRunsCleared.count,
    partnerExtrasUpdated,
    brandRowDeleted: Boolean(existing),
  };
}
