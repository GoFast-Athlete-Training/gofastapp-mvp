import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  generateUniqueCityRunSlug,
  generateCityRunUrlPath,
  generateCityRunUrl,
} from "@/lib/slug-utils";
import { assignUniqueWorkoutShareSlug } from "@/lib/workout-public-slug";

export const dynamic = "force-dynamic";

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCitySlug(city: string | null, stateValue: string | null): string {
  if (!city) return "";

  const normalizedCity = city.toLowerCase().trim();
  const normalizedState = (stateValue || "").toUpperCase().trim();

  if (
    normalizedCity === "district of columbia" ||
    normalizedCity === "dc" ||
    ((normalizedCity === "washington" ||
      normalizedCity === "washington dc" ||
      normalizedCity === "washington, dc") &&
      normalizedState === "DC")
  ) {
    return "dc";
  }

  return slugifyCity(city);
}

function isMissingCityRunsColumn(error: unknown) {
  const e = error as { code?: string; message?: string };
  return (
    e?.code === "P2022" &&
    typeof e?.message === "string" &&
    e.message.includes("city_runs.")
  );
}

const UNSUPPORTED_CITY_RUN_FIELDS = [
  "postRunActivity",
  "stravaUrl",
  "stravaText",
  "webUrl",
  "webText",
  "igPostText",
  "igPostGraphic",
] as const;

function parseRunDate(dateInput: string): Date {
  const s = dateInput.trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoDay) {
    const y = Number(isoDay[1]);
    const m = Number(isoDay[2]);
    const d = Number(isoDay[3]);
    if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      throw new Error("Invalid date");
    }
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed;
}

function buildWorkoutDescriptionHydration(workout: {
  workoutType: string;
  description: string | null;
  workout_catalogue: { name: string } | null;
}): string {
  if (workout.description?.trim()) {
    return workout.description.trim().slice(0, 2000);
  }
  const cat = workout.workout_catalogue?.name;
  const base = `${workout.workoutType} workout${cat ? ` · ${cat}` : ""}`;
  return base.slice(0, 2000);
}

type FromWorkoutBody = {
  workoutId?: string;
  gofastCity?: string;
  cityName?: string;
  state?: string;
  date?: string;
  meetUpPoint?: string;
  meetUpStreetAddress?: string;
  meetUpCity?: string;
  meetUpState?: string;
  meetUpZip?: string;
  startTimeHour?: number | string | null;
  startTimeMinute?: number | string | null;
  startTimePeriod?: string | null;
  timezone?: string | null;
  description?: string | null;
  endPoint?: string | null;
  endStreetAddress?: string | null;
  endCity?: string | null;
  endState?: string | null;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | string | null;
  meetUpLng?: number | string | null;
  /** Group pace label e.g. "7:00-7:30" — stored on city_runs.pace */
  pace?: string | null;
};

/**
 * POST /api/cityrun/from-workout
 * Authenticated athlete creates a CityRun linked to their workout; returns share URL.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = (await request.json()) as FromWorkoutBody;
    const {
      workoutId,
      gofastCity,
      cityName,
      state,
      date,
      meetUpPoint,
      meetUpStreetAddress,
      meetUpCity,
      meetUpState,
      meetUpZip,
      startTimeHour,
      startTimeMinute,
      startTimePeriod,
      timezone,
      description: descriptionOverride,
      endPoint,
      endStreetAddress,
      endCity,
      endState,
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      pace: paceBody,
    } = body;

    if (!workoutId?.trim()) {
      return NextResponse.json({ error: "workoutId is required" }, { status: 400 });
    }
    if (!date?.trim()) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    if (!meetUpPoint?.trim()) {
      return NextResponse.json({ error: "meetUpPoint is required" }, { status: 400 });
    }

    const workout = await prisma.workouts.findFirst({
      where: { id: workoutId.trim(), athleteId: athlete.id },
      include: {
        workout_catalogue: { select: { name: true } },
      },
    });

    if (!workout) {
      return NextResponse.json(
        { error: "Workout not found or you do not own this workout" },
        { status: 404 }
      );
    }

    if (
      !gofastCity?.trim() &&
      !cityName?.trim() &&
      !meetUpCity?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "gofastCity, cityName, or meetUpCity is required so the run can be listed",
        },
        { status: 400 }
      );
    }

    let finalCitySlug: string;
    if (gofastCity?.trim()) {
      finalCitySlug = slugifyCity(gofastCity);
    } else {
      const cityNameToUse = (cityName || meetUpCity || "").trim();
      if (!cityNameToUse) {
        return NextResponse.json(
          { error: "Could not determine city from provided data" },
          { status: 400 }
        );
      }
      finalCitySlug = normalizeCitySlug(
        cityNameToUse,
        meetUpState || state || null
      );
    }

    if (!finalCitySlug) {
      return NextResponse.json({ error: "Invalid city slug" }, { status: 400 });
    }

    let runDateObj: Date;
    try {
      runDateObj = parseRunDate(date);
    } catch {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const existingForWorkout = await prisma.city_runs.count({
      where: { workoutId: workout.id },
    });
    if (existingForWorkout >= 10) {
      return NextResponse.json(
        {
          error:
            "Too many CityRuns already linked to this workout. Remove old invites or contact support.",
        },
        { status: 400 }
      );
    }

    let runSlug: string | null = null;
    try {
      runSlug = await generateUniqueCityRunSlug(workout.title, { date: runDateObj });
    } catch (e) {
      console.warn("[cityrun/from-workout] slug generation failed:", e);
    }

    const workoutDescriptionHydrated =
      descriptionOverride?.trim() ||
      buildWorkoutDescriptionHydration(workout);

    const totalMilesFromWorkout =
      workout.estimatedDistanceInMeters != null &&
      workout.estimatedDistanceInMeters > 0
        ? workout.estimatedDistanceInMeters / 1609.34
        : null;

    const parseHour = (v: number | string | null | undefined) => {
      if (v == null || v === "") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : v;
      return Number.isFinite(n) ? n : null;
    };
    const parseMinute = parseHour;

    const latNum =
      meetUpLat != null && meetUpLat !== ""
        ? Number(meetUpLat)
        : null;
    const lngNum =
      meetUpLng != null && meetUpLng !== ""
        ? Number(meetUpLng)
        : null;
    const meetUpLatFinal =
      latNum != null && Number.isFinite(latNum) ? latNum : null;
    const meetUpLngFinal =
      lngNum != null && Number.isFinite(lngNum) ? lngNum : null;

    const createData: Record<string, unknown> = {
      id: generateId(),
      gofastCity: finalCitySlug,
      slug: runSlug,
      runCrewId: null,
      runClubId: null,
      staffGeneratedId: null,
      athleteGeneratedId: athlete.id,
      title: workout.title.trim(),
      workflowStatus: "APPROVED",
      dayOfWeek: null,
      date: runDateObj,
      startTimeHour: parseHour(startTimeHour ?? null),
      startTimeMinute: parseMinute(startTimeMinute ?? null),
      startTimePeriod: startTimePeriod?.trim() || null,
      timezone: timezone?.trim() || null,
      meetUpPoint: meetUpPoint.trim(),
      meetUpStreetAddress: meetUpStreetAddress?.trim() || null,
      meetUpCity: meetUpCity?.trim() || cityName?.trim() || null,
      meetUpState: meetUpState?.trim() || state?.trim() || null,
      meetUpZip: meetUpZip?.trim() || null,
      routeNeighborhood: null,
      runType: null,
      workoutDescription: workoutDescriptionHydrated,
      meetUpPlaceId: meetUpPlaceId?.trim() || null,
      meetUpLat: meetUpLatFinal,
      meetUpLng: meetUpLngFinal,
      endPoint: endPoint?.trim() || null,
      endStreetAddress: endStreetAddress?.trim() || null,
      endCity: endCity?.trim() || null,
      endState: endState?.trim() || null,
      totalMiles: totalMilesFromWorkout,
      pace: paceBody?.trim() || null,
      stravaMapUrl: null,
      description: null,
      postRunActivity: null,
      routePhotos: Prisma.JsonNull,
      mapImageUrl: null,
      staffNotes: null,
      stravaUrl: null,
      stravaText: null,
      webUrl: null,
      webText: null,
      igPostText: null,
      igPostGraphic: null,
      routeId: null,
      workoutId: workout.id,
      updatedAt: new Date(),
    };

    let run;
    try {
      run = await prisma.city_runs.create({
        data: createData as Parameters<typeof prisma.city_runs.create>[0]["data"],
        select: {
          id: true,
          slug: true,
          runClubId: true,
        },
      });
    } catch (error: unknown) {
      if (!isMissingCityRunsColumn(error)) throw error;
      console.warn(
        "[POST /api/cityrun/from-workout] city_runs column missing; retrying with supported fields"
      );
      for (const field of UNSUPPORTED_CITY_RUN_FIELDS) {
        delete createData[field];
      }
      run = await prisma.city_runs.create({
        data: createData as Parameters<typeof prisma.city_runs.create>[0]["data"],
        select: {
          id: true,
          slug: true,
          runClubId: true,
        },
      });
    }

    let runClubSlug: string | null = null;
    if (run.runClubId) {
      const club = await prisma.run_clubs.findUnique({
        where: { id: run.runClubId },
        select: { slug: true },
      });
      runClubSlug = club?.slug ?? null;
    }

    const path =
      run.slug != null && run.slug !== ""
        ? generateCityRunUrlPath({
            id: run.id,
            slug: run.slug,
            runClub: runClubSlug ? { slug: runClubSlug } : null,
          })
        : `/gorun/${run.id}`;
    const shareUrl =
      run.slug != null && run.slug !== ""
        ? generateCityRunUrl({
            id: run.id,
            slug: run.slug,
            runClub: runClubSlug ? { slug: runClubSlug } : null,
          })
        : (() => {
            const base =
              process.env.NEXT_PUBLIC_APP_URL ||
              process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN ||
              "https://gofastapp.com";
            return `${base.replace(/\/$/, "")}/gorun/${run.id}`;
          })();

    const baseApp =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN ||
      "https://gofastapp.com";
    const baseNorm = baseApp.replace(/\/$/, "");

    const workoutRow = await prisma.workouts.findUnique({
      where: { id: workout.id },
      select: { slug: true },
    });
    let workoutSlug = workoutRow?.slug ?? null;
    if (!workoutSlug?.trim()) {
      workoutSlug = await assignUniqueWorkoutShareSlug({
        workoutId: workout.id,
        gofastHandle: athlete.gofastHandle,
      });
    }
    const workoutPath = `/mytrainingruns/${workoutSlug}`;
    const workoutShareUrl = `${baseNorm}${workoutPath}`;

    return NextResponse.json({
      cityRunId: run.id,
      slug: run.slug,
      path,
      shareUrl,
      workoutSlug,
      workoutPath,
      workoutShareUrl,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[cityrun/from-workout]", error);
    return NextResponse.json(
      { error: err?.message || "Failed to create CityRun" },
      { status: 500 }
    );
  }
}
