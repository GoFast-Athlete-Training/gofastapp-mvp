export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";

function normalizeSlug(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * GET /api/training/public/[slug]
 * Public. Resolves workouts.slug to share page payload.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await params;
    const slug = normalizeSlug(raw || "");
    if (!slug) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workout = await prisma.workouts.findFirst({
      where: { slug },
      include: {
        segments: { orderBy: { stepOrder: "asc" } },
        Athlete: {
          select: {
            firstName: true,
            lastName: true,
            gofastHandle: true,
            photoURL: true,
            city: true,
            state: true,
            primarySport: true,
            bio: true,
          },
        },
        city_runs: {
          orderBy: { date: "desc" },
          take: 5,
          select: {
            id: true,
            slug: true,
            title: true,
            date: true,
            gofastCity: true,
            meetUpPoint: true,
            meetUpStreetAddress: true,
            meetUpCity: true,
            meetUpState: true,
            startTimeHour: true,
            startTimeMinute: true,
            startTimePeriod: true,
            workflowStatus: true,
          },
        },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const primaryGoal = await prisma.athleteGoal.findFirst({
      where: { athleteId: workout.athleteId, status: "ACTIVE" },
      orderBy: { targetByDate: "asc" },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            slug: true,
            raceDate: true,
            city: true,
            state: true,
            distanceMeters: true,
            distanceLabel: true,
          },
        },
      },
    });

    const now = new Date();
    const upcoming = workout.city_runs.find((r) => r.date >= now) ?? workout.city_runs[0] ?? null;

    return NextResponse.json({
      success: true,
      workout: {
        id: workout.id,
        title: workout.title,
        workoutType: workout.workoutType,
        description: workout.description,
        estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
        slug: workout.slug,
        segments: workout.segments.map((s) => ({
          id: s.id,
          stepOrder: s.stepOrder,
          title: s.title,
          durationType: s.durationType,
          durationValue: s.durationValue,
          repeatCount: s.repeatCount,
          notes: s.notes,
        })),
      },
      athlete: workout.Athlete
        ? {
            firstName: workout.Athlete.firstName,
            lastName: workout.Athlete.lastName,
            gofastHandle: workout.Athlete.gofastHandle,
            photoURL: workout.Athlete.photoURL,
            city: workout.Athlete.city,
            state: workout.Athlete.state,
            primarySport: workout.Athlete.primarySport,
            bio: workout.Athlete.bio,
          }
        : null,
      goal: primaryGoal
        ? {
            id: primaryGoal.id,
            name: primaryGoal.name,
            distance: primaryGoal.distance,
            goalTime: primaryGoal.goalTime,
            targetByDate: primaryGoal.targetByDate.toISOString(),
            raceRegistryId: primaryGoal.raceRegistryId,
          }
        : null,
      goalRace: primaryGoal?.race_registry
        ? {
            id: primaryGoal.race_registry.id,
            name: primaryGoal.race_registry.name,
            slug: primaryGoal.race_registry.slug,
            raceDate: primaryGoal.race_registry.raceDate.toISOString(),
            city: primaryGoal.race_registry.city,
            state: primaryGoal.race_registry.state,
            distanceMeters: primaryGoal.race_registry.distanceMeters,
            distanceLabel: primaryGoal.race_registry.distanceLabel,
            distanceMiles:
              primaryGoal.race_registry.distanceMeters != null
                ? metersToMiles(primaryGoal.race_registry.distanceMeters)
                : null,
          }
        : null,
      cityRun: upcoming
        ? {
            id: upcoming.id,
            slug: upcoming.slug,
            title: upcoming.title,
            date: upcoming.date.toISOString(),
            gofastCity: upcoming.gofastCity,
            meetUpPoint: upcoming.meetUpPoint,
            meetUpStreetAddress: upcoming.meetUpStreetAddress,
            meetUpCity: upcoming.meetUpCity,
            meetUpState: upcoming.meetUpState,
            startTimeHour: upcoming.startTimeHour,
            startTimeMinute: upcoming.startTimeMinute,
            startTimePeriod: upcoming.startTimePeriod,
            gorunPath: `/gorun/${upcoming.id}`,
          }
        : null,
    });
  } catch (e: unknown) {
    console.error("GET /api/training/public/[slug]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
