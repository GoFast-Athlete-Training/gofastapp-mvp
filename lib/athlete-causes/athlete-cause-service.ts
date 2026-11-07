import prisma from "@/lib/prisma";
import { normalizeCauseWebsiteUrl } from "@/lib/athlete-causes/cause-url";

export type AthleteCauseRow = {
  id: string;
  athleteId: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  note: string | null;
  raceRegistryId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listAthleteCauses(athleteId: string): Promise<AthleteCauseRow[]> {
  return prisma.athlete_causes.findMany({
    where: { athleteId },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getAthleteCauseForOwner(
  athleteId: string,
  id: string,
): Promise<AthleteCauseRow | null> {
  return prisma.athlete_causes.findFirst({
    where: { id, athleteId },
  });
}

/** Manual create: returns existing row when normalized URL already saved for this athlete. */
export async function upsertAthleteCauseManual(input: {
  athleteId: string;
  name: string;
  websiteUrlRaw: string;
  logoUrl?: string | null;
  note?: string | null;
}): Promise<{ row: AthleteCauseRow; created: boolean }> {
  const normalized = normalizeCauseWebsiteUrl(input.websiteUrlRaw);
  if (!normalized) {
    throw new Error("Invalid website URL");
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error("Name is required");
  }

  const existing = await prisma.athlete_causes.findFirst({
    where: { athleteId: input.athleteId, websiteUrl: normalized },
  });
  if (existing) {
    return { row: existing, created: false };
  }

  const row = await prisma.athlete_causes.create({
    data: {
      athleteId: input.athleteId,
      name,
      websiteUrl: normalized,
      logoUrl: input.logoUrl?.trim() || null,
      note: input.note?.trim() || null,
    },
  });
  return { row, created: true };
}

/** From race_registry charity snap; returns existing when URL already saved. */
export async function upsertAthleteCauseFromRaceRegistry(input: {
  athleteId: string;
  raceRegistryId: string;
}): Promise<{ row: AthleteCauseRow; created: boolean }> {
  const reg = await prisma.race_registry.findFirst({
    where: { id: input.raceRegistryId.trim() },
    select: {
      id: true,
      charityName: true,
      charityUrl: true,
      charityLogo: true,
    },
  });
  if (!reg) {
    throw new Error("Race not found in registry");
  }
  const charityName = reg.charityName?.trim();
  const charityUrl = reg.charityUrl?.trim();
  if (!charityName || !charityUrl) {
    throw new Error("This race has no charity snap with a URL");
  }
  if (!/^https?:\/\//i.test(charityUrl)) {
    throw new Error("Charity URL must start with http(s)://");
  }
  const normalized = normalizeCauseWebsiteUrl(charityUrl);
  if (!normalized) {
    throw new Error("Invalid charity URL");
  }

  const existing = await prisma.athlete_causes.findFirst({
    where: { athleteId: input.athleteId, websiteUrl: normalized },
  });
  if (existing) {
    const updated =
      existing.raceRegistryId !== reg.id ||
      existing.name !== charityName ||
      existing.logoUrl !== (reg.charityLogo?.trim() || null)
        ? await prisma.athlete_causes.update({
            where: { id: existing.id },
            data: {
              name: charityName,
              logoUrl: reg.charityLogo?.trim() || null,
              raceRegistryId: reg.id,
            },
          })
        : existing;
    return { row: updated, created: false };
  }

  const row = await prisma.athlete_causes.create({
    data: {
      athleteId: input.athleteId,
      name: charityName,
      websiteUrl: normalized,
      logoUrl: reg.charityLogo?.trim() || null,
      raceRegistryId: reg.id,
    },
  });
  return { row, created: true };
}
