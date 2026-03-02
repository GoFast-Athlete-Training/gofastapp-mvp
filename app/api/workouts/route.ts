import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { adminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/workouts
 * List workouts for the authenticated athlete
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Fetch workouts with segments
    const workouts = await prisma.workouts.findMany({
      where: { athleteId: athlete.id },
      include: {
        segments: {
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ workouts });
  } catch (error: any) {
    console.error("Error fetching workouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch workouts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workouts
 * Create a new workout
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      description,
      stravaUrl,
      workoutType = "Easy",
      segments, // Array of segment objects
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "At least one segment is required" },
        { status: 400 }
      );
    }

    // Create workout with segments
    const workout = await prisma.workouts.create({
      data: {
        id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description,
        stravaUrl: stravaUrl || null,
        workoutType: workoutType as any,
        athleteId: athlete.id,
        segments: {
          create: segments.map((seg: any, index: number) => ({
            id: `segment_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            stepOrder: seg.stepOrder || index + 1,
            title: seg.title,
            durationType: seg.durationType || "DISTANCE",
            durationValue: seg.durationValue,
            targets: seg.targets || null, // JSON array of target objects
            repeatCount: seg.repeatCount || null,
            notes: seg.notes || null,
          })),
        },
      },
      include: {
        segments: true,
      },
    });

    return NextResponse.json({ workout });
  } catch (error: any) {
    console.error("Error creating workout:", error);
    return NextResponse.json(
      { error: "Failed to create workout" },
      { status: 500 }
    );
  }
}
