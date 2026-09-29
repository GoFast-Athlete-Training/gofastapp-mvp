import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from "@/lib/training/training-engine-auth";
import { normalizeInstagramUrl, normalizeStravaUrl, normalizeWebsiteUrl } from "@/lib/runclub-urls";

export const dynamic = "force-dynamic";

/**
 * GET /api/runmanage/run-clubs/[clubId]
 * Prod run_clubs public link fields for staff editor.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;
  if (!getForwardedStaffId(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { clubId } = await params;
  const club = await prisma.run_clubs.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      websiteUrl: true,
      instagramUrl: true,
      stravaUrl: true,
      runUrl: true,
    },
  });

  if (!club) {
    return NextResponse.json({ success: false, error: "Run club not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, runClub: club });
}

/**
 * PUT /api/runmanage/run-clubs/[clubId]
 * Update prod run_clubs public URLs (staff lane).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;
  if (!getForwardedStaffId(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { clubId } = await params;
  const body = await request.json().catch(() => ({}));

  const websiteUrl =
    body.websiteUrl !== undefined
      ? normalizeWebsiteUrl(body.websiteUrl)
      : body.url !== undefined
        ? normalizeWebsiteUrl(body.url)
        : undefined;
  const instagramUrl =
    body.instagramUrl !== undefined ? normalizeInstagramUrl(body.instagramUrl) : undefined;
  const stravaUrl =
    body.stravaUrl !== undefined ? normalizeStravaUrl(body.stravaUrl) : undefined;

  const data: Record<string, string | null | undefined> = {};
  if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
  if (instagramUrl !== undefined) data.instagramUrl = instagramUrl;
  if (stravaUrl !== undefined) data.stravaUrl = stravaUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  const runClub = await prisma.run_clubs.update({
    where: { id: clubId },
    data,
    select: {
      id: true,
      slug: true,
      name: true,
      websiteUrl: true,
      instagramUrl: true,
      stravaUrl: true,
    },
  });

  return NextResponse.json({ success: true, runClub });
}
