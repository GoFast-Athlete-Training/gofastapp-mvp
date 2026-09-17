export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRaceRegistryUuid } from "@/lib/race-hub-urls";

const raceSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  raceDate: true,
  city: true,
  state: true,
  distanceLabel: true,
  distanceMeters: true,
  registrationUrl: true,
  registrationCloseDate: true,
  registrationSoldOut: true,
  transferDeadline: true,
  summaryPhrase: true,
  description: true,
} as const;

/**
 * GET /api/race-hub/public/resolve-by-slug/[slug]
 * Public race card for invite flow — no auth.
 * Accepts canonical slug or race_registry UUID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await params;
    const slug = raw?.trim();
    if (!slug) {
      return NextResponse.json({ success: false, error: "slug required" }, { status: 400 });
    }

    const activeWhere = {
      isActive: true,
      isCancelled: false,
    } as const;

    let race = isRaceRegistryUuid(slug)
      ? await prisma.race_registry.findFirst({
          where: { id: slug, ...activeWhere },
          select: raceSelect,
        })
      : null;

    if (!race) {
      race = await prisma.race_registry.findFirst({
        where: { slug, ...activeWhere },
        select: raceSelect,
      });
    }

    if (!race) {
      race = await prisma.race_registry.findFirst({
        where: {
          slug: { equals: slug, mode: "insensitive" },
          ...activeWhere,
        },
        select: raceSelect,
      });
    }

    if (!race) {
      return NextResponse.json({ success: false, error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        slug: race.slug,
        logoUrl: race.logoUrl,
        raceDate: race.raceDate.toISOString(),
        city: race.city,
        state: race.state,
        distanceLabel: race.distanceLabel,
        distanceMeters: race.distanceMeters,
        registrationUrl: race.registrationUrl,
        registrationCloseDate: race.registrationCloseDate?.toISOString() ?? null,
        registrationSoldOut: race.registrationSoldOut,
        transferDeadline: race.transferDeadline?.toISOString() ?? null,
        summaryPhrase: race.summaryPhrase,
        description: race.description,
      },
    });
  } catch (err) {
    console.error("resolve-by-slug:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
