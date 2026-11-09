import { prisma } from "@/lib/prisma";

export type ProdCharitySnapInput = {
  charityId?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  charityWebsiteUrl?: string | null;
  charityLogo?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  description?: string | null;
  mission?: string | null;
  charitySupports?: string | null;
  notes?: string | null;
};

function trimOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export async function upsertProdCharitySnap(c: ProdCharitySnapInput) {
  const charityId = c.charityId?.trim();
  const name = c.name?.trim();

  if (!charityId || !name) {
    return {
      ok: false as const,
      status: 400,
      error: "charity.charityId and charity.name are required",
    };
  }

  const now = new Date();
  const data = {
    name,
    email: trimOrNull(c.email),
    phone: trimOrNull(c.phone),
    charityWebsiteUrl: trimOrNull(c.charityWebsiteUrl),
    charityLogo: trimOrNull(c.charityLogo),
    city: trimOrNull(c.city),
    state: trimOrNull(c.state),
    address: trimOrNull(c.address),
    description: trimOrNull(c.description),
    mission: trimOrNull(c.mission),
    charitySupports: trimOrNull(c.charitySupports),
    notes: trimOrNull(c.notes),
    syncedAt: now,
    updatedAt: now,
  };

  const charity = await prisma.charities.upsert({
    where: { id: charityId },
    create: { id: charityId, ...data, createdAt: now },
    update: data,
  });

  return { ok: true as const, charity };
}

export const prodCharityPublicSelect = {
  id: true,
  name: true,
  charityWebsiteUrl: true,
  charityLogo: true,
  city: true,
  state: true,
  mission: true,
  charitySupports: true,
  description: true,
  syncedAt: true,
  updatedAt: true,
} as const;
