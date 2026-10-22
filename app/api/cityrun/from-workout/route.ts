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
import { parseCalendarDateForWrite } from "@/lib/calendar-date";
import { WORKOUT_BACKED_CITY_RUN_VISIBILITY } from '@/lib/cityrun/workout-backed-run-visibility';
import { autoRsvpHostRole, buildJoinRunSignupUrl } from "@/lib/host-run-rsvp";
import { stampPlannedWorkoutCityRun } from "@/lib/city-run/stamp-planned-city-run";
import { resolveSpawnedWorkoutForPlanned } from '@/lib/training/match-planned-workout';
import { resolveWorkoutTargetForAthlete } from '@/lib/training/workout-or-planned-resolve';
import { inferRegionSlugFromCitySlug } from '@/lib/region-slug';
import {
  cityRunMediaFromSavedRoute,
  resolveSavedRouteForAthlete,
} from '@/lib/city-run/saved-route-for-athlete';
import { mergeCityRunRouteMedia, mergeTotalMiles } from '@/lib/city-run/merge-route-media';
import { normalizeProfileEmoji } from '@/lib/city-run/run-profile-visual';

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
  "stravaEventUrl",
  "stravaText",
  "webUrl",
  "webText",
  "igPostText",
  "igPostGraphic",
  "meetUpNote",
] as const;

async function resolveOwnedWorkoutForCityRunInvite(
  workoutId: string,
  athleteId: string
) {
  const target = await resolveWorkoutTargetForAthlete(workoutId.trim(), athleteId);
  if (!target) return null;

  if (target.kind === "standalone") {
    return prisma.workouts.findFirst({
      where: { id: target.workoutId, athleteId },
    });
  }

  let instanceWorkoutId = target.instanceWorkoutId;
  if (!instanceWorkoutId) {
    try {
      instanceWorkoutId = await resolveSpawnedWorkoutForPlanned(target.plannedWorkoutId);
    } catch {
      return null;
    }
  }

  return prisma.workouts.findFirst({
    where: { id: instanceWorkoutId, athleteId },
  });
}

type FromWorkoutBody = {
  workoutId?: string;
  /** Canonical plan-day id for planned_workouts.cityRunId stamp. */
  plannedWorkoutId?: string;
  citySlug?: string;
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
  meetUpNote?: string | null;
  workoutNarrative?: string | null;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | string | null;
  meetUpLng?: number | string | null;
  stravaMapUrl?: string | null;
  routeNeighborhood?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: string[] | null;
  runPhotos?: string[] | null;
  /** Path prose for the route block (shows on invite when no saved route description). */
  workoutDescription?: string | null;
  /** Social meetup title — required; never defaults to plan workout title. */
  title?: string;
  /** Optional pace band label for city run listing (e.g. 7:00-7:30). */
  pace?: string | null;
  /** Optional social description for the run invite. */
  description?: string | null;
  /** Override total miles on city run (defaults from workout distance). */
  totalMiles?: number | null;
  /** Saved route from My Routes — copies map media onto the city run. */
  routeId?: string | null;
  profileEmoji?: string | null;
  coverPhotoUrl?: string | null;
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
      plannedWorkoutId: plannedWorkoutIdBody,
      citySlug,
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
      meetUpNote,
      workoutNarrative,
      meetUpPlaceId,
      meetUpLat,
      meetUpLng,
      stravaMapUrl: stravaMapUrlBody,
      routeNeighborhood,
      mapImageUrl,
      routePhotos,
      runPhotos,
      title: socialTitleBody,
      pace: paceBody,
      description: descriptionBody,
      workoutDescription: workoutDescriptionBody,
      totalMiles: totalMilesBody,
      routeId: routeIdBody,
      profileEmoji: profileEmojiBody,
      coverPhotoUrl: coverPhotoUrlBody,
    } = body;

    const workoutIdTrimmed = workoutId?.trim() || null;

    if (!date?.trim()) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    if (!meetUpPoint?.trim()) {
      return NextResponse.json({ error: "meetUpPoint is required" }, { status: 400 });
    }
    if (!meetUpCity?.trim()) {
      return NextResponse.json(
        { error: "meetUpCity is required — pick a Google Places result." },
        { status: 400 }
      );
    }

    const socialTitle = socialTitleBody?.trim();
    if (!socialTitle) {
      return NextResponse.json(
        { error: "title is required — give your run a social name (e.g. Saturday morning miles)." },
        { status: 400 }
      );
    }

    const parseHour = (v: number | string | null | undefined) => {
      if (v == null || v === "") return null;
      const n = typeof v === "string" ? parseInt(v, 10) : v;
      return Number.isFinite(n) ? n : null;
    };
    const parseMinute = parseHour;

    const parsedHour = parseHour(startTimeHour ?? null);
    const parsedMinute = parseMinute(startTimeMinute ?? null);
    const parsedPeriod = startTimePeriod?.trim().toUpperCase() || null;

    if (
      parsedHour == null ||
      parsedHour < 1 ||
      parsedHour > 12 ||
      parsedMinute == null ||
      parsedMinute < 0 ||
      parsedMinute > 59 ||
      (parsedPeriod !== "AM" && parsedPeriod !== "PM")
    ) {
      return NextResponse.json(
        { error: "Start time is required (hour, minute, and AM/PM)." },
        { status: 400 }
      );
    }

    let workout: Awaited<ReturnType<typeof resolveOwnedWorkoutForCityRunInvite>> = null;
    let resolvedPlannedWorkoutId: string | null = plannedWorkoutIdBody?.trim() || null;

    if (workoutIdTrimmed) {
      workout = await resolveOwnedWorkoutForCityRunInvite(
        workoutIdTrimmed,
        athlete.id
      );

      if (!workout) {
        return NextResponse.json(
          { error: "Workout not found or you do not own this workout" },
          { status: 404 }
        );
      }

      const workoutTarget = await resolveWorkoutTargetForAthlete(
        workoutIdTrimmed,
        athlete.id
      );
      resolvedPlannedWorkoutId =
        plannedWorkoutIdBody?.trim() ||
        (workoutTarget?.kind === "planned" ? workoutTarget.plannedWorkoutId : null);
    }

    if (resolvedPlannedWorkoutId) {
      const plannedRow = await prisma.planned_workouts.findFirst({
        where: { id: resolvedPlannedWorkoutId, athleteId: athlete.id },
        select: { id: true, cityRunId: true },
      });
      if (!plannedRow) {
        return NextResponse.json(
          { error: "Planned workout not found for this athlete" },
          { status: 404 }
        );
      }
      if (plannedRow.cityRunId) {
        return NextResponse.json(
          { error: "This plan day already has a meetup linked." },
          { status: 400 }
        );
      }
    }

    if (
      !citySlug?.trim() &&
      !cityName?.trim() &&
      !meetUpCity?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "citySlug, cityName, or meetUpCity is required so the run can be listed",
        },
        { status: 400 }
      );
    }

    let finalCitySlug: string;
    if (citySlug?.trim()) {
      finalCitySlug = slugifyCity(citySlug);
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
      runDateObj = parseCalendarDateForWrite(date);
    } catch {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const finalTitle = socialTitle;

    let runSlug: string | null = null;
    try {
      runSlug = await generateUniqueCityRunSlug(finalTitle, {
        date: runDateObj,
        clubSlug: null,
      });
    } catch (e) {
      console.warn("[cityrun/from-workout] slug generation failed:", e);
    }

    const totalMilesFromWorkout =
      workout != null &&
      workout.estimatedDistanceInMeters != null &&
      workout.estimatedDistanceInMeters > 0
        ? workout.estimatedDistanceInMeters / 1609.34
        : null;

    const routeIdTrimmed =
      typeof routeIdBody === 'string' ? routeIdBody.trim() : '';
    let savedRouteMedia: ReturnType<typeof cityRunMediaFromSavedRoute> | null = null;
    let savedRouteRow: Awaited<ReturnType<typeof resolveSavedRouteForAthlete>> = null;
    if (routeIdTrimmed) {
      savedRouteRow = await resolveSavedRouteForAthlete(athlete.id, routeIdTrimmed);
      if (!savedRouteRow) {
        return NextResponse.json(
          { error: 'Route not found or not in your My Routes' },
          { status: 404 }
        );
      }
      savedRouteMedia = cityRunMediaFromSavedRoute(savedRouteRow);
    }

    const totalMilesParsed = mergeTotalMiles(
      totalMilesBody != null && Number.isFinite(Number(totalMilesBody)) && Number(totalMilesBody) > 0
        ? Number(totalMilesBody)
        : null,
      savedRouteMedia?.totalMiles ?? null,
      totalMilesFromWorkout
    );

    const paceLabel = typeof paceBody === 'string' && paceBody.trim() ? paceBody.trim() : null;
    const workoutDescriptionLabel =
      typeof workoutDescriptionBody === 'string' && workoutDescriptionBody.trim()
        ? workoutDescriptionBody.trim()
        : null;
    const descriptionLabel =
      typeof descriptionBody === 'string' && descriptionBody.trim()
        ? descriptionBody.trim()
        : null;

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

    const streetFallback =
      meetUpStreetAddress?.trim() || meetUpPoint.trim();

    const mergedRoute = mergeCityRunRouteMedia(
      {
        stravaMapUrl: stravaMapUrlBody,
        mapImageUrl,
        routeNeighborhood,
        routePhotos,
      },
      savedRouteMedia
    );

    const runPhotoUrls =
      Array.isArray(runPhotos) && runPhotos.length > 0
        ? runPhotos.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        : [];

    const narrativeTrimmed = workoutNarrative?.trim() || null;
    if (narrativeTrimmed && workout) {
      await prisma.workouts.update({
        where: { id: workout.id },
        data: {
          workoutNarrative: narrativeTrimmed,
          updatedAt: new Date(),
        },
      });
    }

    const createData: Record<string, unknown> = {
      id: generateId(),
      citySlug: finalCitySlug,
      regionSlug: inferRegionSlugFromCitySlug(finalCitySlug),
      slug: runSlug,
      runCrewId: null,
      runClubId: null,
      staffGeneratedId: null,
      athleteGeneratedId: athlete.id,
      cityRunType: 'INDIVIDUAL',
      title: finalTitle,
      ...WORKOUT_BACKED_CITY_RUN_VISIBILITY,
      dayOfWeek: null,
      date: runDateObj,
      startTimeHour: parsedHour,
      startTimeMinute: parsedMinute,
      startTimePeriod: parsedPeriod,
      timezone: null,
      meetUpPoint: meetUpPoint.trim(),
      meetUpStreetAddress: streetFallback,
      meetUpCity: meetUpCity?.trim() || cityName?.trim() || null,
      meetUpState: meetUpState?.trim() || state?.trim() || null,
      meetUpZip: meetUpZip?.trim() || null,
      meetUpNote: meetUpNote?.trim() || null,
      routeNeighborhood: mergedRoute.routeNeighborhood,
      runType: mergedRoute.runType,
      workoutDescription:
        savedRouteRow?.routeDescription?.trim() || workoutDescriptionLabel || null,
      meetUpPlaceId: meetUpPlaceId?.trim() || null,
      meetUpLat: meetUpLatFinal,
      meetUpLng: meetUpLngFinal,
      endPoint: null,
      endStreetAddress: null,
      endCity: null,
      endState: null,
      totalMiles: totalMilesParsed,
      pace: paceLabel,
      stravaMapUrl: mergedRoute.stravaMapUrl,
      description: descriptionLabel,
      postRunActivity: null,
      routePhotos: mergedRoute.routePhotos,
      runPhotos: runPhotoUrls.length > 0 ? runPhotoUrls : Prisma.JsonNull,
      mapImageUrl: mergedRoute.mapImageUrl,
      profileEmoji: normalizeProfileEmoji(profileEmojiBody ?? null),
      coverPhotoUrl: coverPhotoUrlBody?.trim() || null,
      staffNotes: null,
      stravaEventUrl: null,
      stravaText: null,
      webUrl: null,
      webText: null,
      igPostText: null,
      igPostGraphic: null,
      routeId: mergedRoute.routeId,
      workoutId: workout?.id ?? null,
      updatedAt: new Date(),
    };

    const { stampCityRunStartsAtOnCreateData } = await import(
      "@/lib/city-run/stamp-city-run-write"
    );
    stampCityRunStartsAtOnCreateData(createData);

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
      delete createData.runPhotos;
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

    let workoutSlug: string | null = null;
    let workoutPath: string | null = null;
    let workoutShareUrl: string | null = null;

    if (workout) {
      const workoutRow = await prisma.workouts.findUnique({
        where: { id: workout.id },
        select: { slug: true },
      });
      workoutSlug = workoutRow?.slug ?? null;
      if (!workoutSlug?.trim()) {
        workoutSlug = await assignUniqueWorkoutShareSlug({
          workoutId: workout.id,
          gofastHandle: athlete.gofastHandle,
        });
      }
      workoutPath = `/mytrainingruns/${workoutSlug}`;
      workoutShareUrl = `${baseNorm}${workoutPath}`;
    }

    if (resolvedPlannedWorkoutId) {
      const stamp = await stampPlannedWorkoutCityRun(
        resolvedPlannedWorkoutId,
        athlete.id,
        run.id
      );
      if (!stamp.ok) {
        return NextResponse.json({ error: stamp.message }, { status: 400 });
      }
    }

    if (workout?.id) {
      const { pushWorkoutToGarminForAthlete } = await import(
        "@/lib/garmin-workouts/push-workout-for-athlete"
      );
      void pushWorkoutToGarminForAthlete(athlete.id, workout.id).catch((err) => {
        console.warn("[cityrun/from-workout] Garmin push skipped:", err);
      });
    }

    await autoRsvpHostRole(run.id, athlete.id);

    const joinSignupUrl = buildJoinRunSignupUrl(run.slug, baseNorm);

    return NextResponse.json({
      cityRunId: run.id,
      slug: run.slug,
      path,
      shareUrl,
      joinSignupUrl,
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
