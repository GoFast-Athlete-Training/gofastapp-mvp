export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  getAthleteHostedRunInviteForHost,
} from "@/lib/city-run/list-athlete-hosted-invites";
import { deleteAthleteHostedRunInvite } from "@/lib/city-run/delete-athlete-hosted-invite";
import { parseRunTotalMiles } from "@/lib/parse-run-total-miles";
import { generateCitySlugFromParts } from "@/lib/parse-google-address";
import prisma from "@/lib/prisma";

type PatchBody = {
  title?: string;
  date?: string;
  meetUpPoint?: string;
  meetUpStreetAddress?: string;
  meetUpCity?: string;
  meetUpState?: string;
  meetUpZip?: string;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | null;
  meetUpLng?: number | null;
  description?: string | null;
  routeNeighborhood?: string | null;
  pace?: string | null;
  totalMiles?: number | string | null;
  startTimeHour?: number | string | null;
  startTimeMinute?: number | string | null;
  startTimePeriod?: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityRunId: string }> },
) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { cityRunId } = await params;
  const invite = await getAthleteHostedRunInviteForHost(auth.athlete.id, cityRunId.trim());
  if (!invite) {
    return NextResponse.json({ error: "Run invite not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, invite });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cityRunId: string }> },
) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { cityRunId } = await params;
  const existing = await getAthleteHostedRunInviteForHost(auth.athlete.id, cityRunId.trim());
  if (!existing) {
    return NextResponse.json({ error: "Run invite not found" }, { status: 404 });
  }

  const body = (await request.json()) as PatchBody;
  const title = typeof body.title === "string" ? body.title.trim() : existing.title;
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const meetUpCity =
    typeof body.meetUpCity === "string" ? body.meetUpCity.trim() : existing.meetUpCity ?? "";
  const meetUpState =
    typeof body.meetUpState === "string" ? body.meetUpState.trim() : existing.meetUpState ?? "";
  const citySlug = generateCitySlugFromParts(meetUpCity, meetUpState) || existing.citySlug;

  let startTimeHour = existing.startTimeHour;
  let startTimeMinute = existing.startTimeMinute;
  let startTimePeriod = existing.startTimePeriod;
  if (body.startTimeHour != null && body.startTimeMinute != null && body.startTimePeriod) {
    const h = Math.min(12, Math.max(1, parseInt(String(body.startTimeHour), 10)));
    const m = Math.min(59, Math.max(0, parseInt(String(body.startTimeMinute), 10) || 0));
    const p = String(body.startTimePeriod).trim().toUpperCase();
    if (Number.isFinite(h) && (p === "AM" || p === "PM")) {
      startTimeHour = h;
      startTimeMinute = m;
      startTimePeriod = p;
    }
  }

  let runDate = new Date(existing.date);
  if (typeof body.date === "string" && body.date.trim()) {
    const d = new Date(`${body.date.trim()}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) runDate = d;
  }

  await prisma.city_runs.update({
    where: { id: cityRunId.trim() },
    data: {
      title,
      citySlug,
      date: runDate,
      meetUpPoint:
        typeof body.meetUpPoint === "string" && body.meetUpPoint.trim()
          ? body.meetUpPoint.trim()
          : existing.meetUpPoint,
      meetUpStreetAddress:
        typeof body.meetUpStreetAddress === "string"
          ? body.meetUpStreetAddress.trim() || null
          : existing.meetUpStreetAddress,
      meetUpCity: meetUpCity || null,
      meetUpState: meetUpState || null,
      meetUpZip:
        typeof body.meetUpZip === "string" ? body.meetUpZip.trim() || null : existing.meetUpZip,
      meetUpPlaceId:
        body.meetUpPlaceId !== undefined
          ? body.meetUpPlaceId?.trim() || null
          : existing.meetUpPlaceId,
      meetUpLat: body.meetUpLat !== undefined ? body.meetUpLat : existing.meetUpLat,
      meetUpLng: body.meetUpLng !== undefined ? body.meetUpLng : existing.meetUpLng,
      description:
        body.description !== undefined
          ? body.description?.trim() || null
          : existing.description,
      routeNeighborhood:
        body.routeNeighborhood !== undefined
          ? body.routeNeighborhood?.trim() || null
          : existing.routeNeighborhood,
      pace: body.pace !== undefined ? body.pace?.trim() || null : existing.pace,
      totalMiles:
        body.totalMiles !== undefined
          ? parseRunTotalMiles(body.totalMiles)
          : existing.totalMiles,
      startTimeHour,
      startTimeMinute,
      startTimePeriod,
      updatedAt: new Date(),
    },
  });

  const invite = await getAthleteHostedRunInviteForHost(auth.athlete.id, cityRunId.trim());
  return NextResponse.json({ success: true, invite });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cityRunId: string }> },
) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { cityRunId } = await params;
  const result = await deleteAthleteHostedRunInvite(auth.athlete.id, cityRunId.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
