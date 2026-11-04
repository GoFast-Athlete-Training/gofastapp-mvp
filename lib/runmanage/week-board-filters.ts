import { prisma } from "@/lib/prisma";

export type RegionCityOption = {
  regionSlug: string;
  regionName: string;
  citySlug: string;
  cityName: string;
};

export async function listRegionCityOptions(): Promise<RegionCityOption[]> {
  const regions = await prisma.regions.findMany({
    orderBy: { name: "asc" },
    include: {
      cities: {
        orderBy: { name: "asc" },
        select: { slug: true, name: true },
      },
    },
  });

  const out: RegionCityOption[] = [];
  for (const region of regions) {
    for (const city of region.cities) {
      out.push({
        regionSlug: region.slug,
        regionName: region.name,
        citySlug: city.slug,
        cityName: city.name,
      });
    }
  }
  return out;
}
