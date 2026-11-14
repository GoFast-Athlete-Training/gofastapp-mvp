export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { dateKeyToUtcStartOfDay, isDateKey } from "@/lib/calendar-date";
import {
  buildDayValidateLlmPacket,
  dayRunRowFromManageRun,
} from "@/lib/runmanage/day-validate-llm-packet";

/** GET — runs for one calendar day (staff manage). City and region are optional. */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const region = request.nextUrl.searchParams.get("region")?.trim() ?? "";
  const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
  const dayYmd = request.nextUrl.searchParams.get("dayYmd")?.trim() ?? "";
  if (!isDateKey(dayYmd)) {
    return NextResponse.json(
      { success: false, error: "dayYmd is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const start = dateKeyToUtcStartOfDay(dayYmd);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const where: {
    date: { gte: Date; lt: Date };
    regionSlug?: string;
    citySlug?: string;
  } = {
    date: { gte: start, lt: end },
  };
  if (region) where.regionSlug = region;
  if (city) where.citySlug = city;

  const runs = await prisma.city_runs.findMany({
    where,
    orderBy: [{ startTimeHour: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      date: true,
      citySlug: true,
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

  const scopedToCity = Boolean(city);
  const citySlugs = [
    ...new Set(runs.map((r) => r.citySlug).filter((slug): slug is string => Boolean(slug))),
  ];
  const namedCities = citySlugs.length
    ? await prisma.cities.findMany({
        where: { slug: { in: citySlugs } },
        select: { slug: true, name: true },
      })
    : [];
  const nameBySlug = new Map(namedCities.map((row) => [row.slug, row.name]));

  let cityLabel = "All metros";
  if (city) {
    const fromRuns = nameBySlug.get(city);
    if (fromRuns) {
      cityLabel = `${fromRuns} (${city})`;
    } else {
      const cityRow = await prisma.cities.findFirst({
        where: region ? { slug: city, region: { slug: region } } : { slug: city },
        select: { name: true },
      });
      cityLabel = cityRow?.name ? `${cityRow.name} (${city})` : city;
    }
  } else if (region) {
    const regionRow = await prisma.regions.findFirst({
      where: { slug: region },
      select: { name: true },
    });
    cityLabel = regionRow?.name ? `${regionRow.name} (${region})` : region;
  }

  const packetRuns = runs.map((r) =>
    dayRunRowFromManageRun({
      ...r,
      date: r.date.toISOString(),
      cityName: scopedToCity
        ? null
        : r.citySlug
          ? nameBySlug.get(r.citySlug)
            ? `${nameBySlug.get(r.citySlug)} (${r.citySlug})`
            : r.citySlug
          : null,
    })
  );

  return NextResponse.json({
    success: true,
    runs,
    packet: buildDayValidateLlmPacket({
      cityLabel,
      dayYmd,
      runs: packetRuns,
      scopedToCity,
    }),
  });
}
