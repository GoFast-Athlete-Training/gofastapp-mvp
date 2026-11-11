export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { dateKeyToUtcStartOfDay } from "@/lib/calendar-date";
import {
  buildDayValidateLlmPacket,
  dayRunRowFromManageRun,
} from "@/lib/runmanage/day-validate-llm-packet";

/** GET — runs for one city on one calendar day (staff manage). */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const region = request.nextUrl.searchParams.get("region")?.trim() ?? "";
  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const dayYmd = request.nextUrl.searchParams.get("dayYmd")?.trim() ?? "";
  if (!region || !city || !dayYmd) {
    return NextResponse.json(
      { success: false, error: "region, city, and dayYmd are required" },
      { status: 400 }
    );
  }

  const start = dateKeyToUtcStartOfDay(dayYmd);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const runs = await prisma.city_runs.findMany({
    where: {
      regionSlug: region,
      citySlug: city,
      date: { gte: start, lt: end },
    },
    orderBy: [{ startTimeHour: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      date: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      meetUpPoint: true,
      stravaEventUrl: true,
      webUrl: true,
      runClubId: true,
      runSeriesId: true,
      published: true,
      runClub: {
        select: { id: true, name: true, websiteUrl: true, stravaUrl: true },
      },
    },
  });

  const packetRuns = runs.map((r) =>
    dayRunRowFromManageRun({
      ...r,
      date: r.date.toISOString(),
    })
  );

  const cityRow = await prisma.cities.findFirst({
    where: { slug: city, region: { slug: region } },
    select: { name: true, slug: true },
  });

  return NextResponse.json({
    success: true,
    runs,
    packet: buildDayValidateLlmPacket({
      cityLabel: cityRow?.name ? `${cityRow.name} (${city})` : city,
      dayYmd,
      runs: packetRuns,
    }),
  });
}
