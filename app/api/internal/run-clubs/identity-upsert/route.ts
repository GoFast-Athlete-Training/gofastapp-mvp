export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import {
  ensureUniqueProdClubSlug,
  generateClubSlugFromName,
  mergeProdClubIdentityFields,
  parseClubReferenceForProd,
} from "@/lib/run-clubs/club-identity";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/internal/run-clubs/identity-upsert — id-preserving minimal mirror. */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  let body: {
    id?: string;
    slug?: string;
    name?: string;
    city?: string;
    reference?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body.id?.trim();
  const name = body.name?.trim();
  const city = body.city?.trim();
  const reference = body.reference?.trim();

  if (!id || !name || !city || !reference) {
    return NextResponse.json(
      { success: false, error: "id, name, city, and reference are required" },
      { status: 400 },
    );
  }

  const refFields = parseClubReferenceForProd(reference);
  const incomingIdentity = {
    name,
    city,
    websiteUrl: refFields.websiteUrl,
    instagramUrl: refFields.instagramUrl,
    stravaUrl: refFields.stravaUrl,
    runUrl: refFields.runUrl,
  };

  const existing = await prisma.run_clubs.findUnique({ where: { id } });

  let slug =
    body.slug?.trim() ||
    existing?.slug ||
    (await ensureUniqueProdClubSlug(generateClubSlugFromName(name), id));

  if (!existing) {
    const slugTaken = await prisma.run_clubs.findUnique({ where: { slug }, select: { id: true } });
    if (slugTaken && slugTaken.id !== id) {
      slug = await ensureUniqueProdClubSlug(generateClubSlugFromName(name), id);
    }
  }

  const merged = existing
    ? mergeProdClubIdentityFields(existing, incomingIdentity)
    : incomingIdentity;

  const club = existing
    ? await prisma.run_clubs.update({
        where: { id },
        data: {
          ...merged,
          slug: existing.slug?.trim() ? existing.slug : slug,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true, name: true, city: true, slug: true },
      })
    : await prisma.run_clubs.create({
        data: {
          id,
          slug,
          ...merged,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
        select: { id: true, name: true, city: true, slug: true },
      });

  return NextResponse.json({
    success: true,
    club,
    created: !existing,
  });
}
