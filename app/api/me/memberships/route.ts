export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { prisma } from "@/lib/prisma";

function pickPrimaryCrewId(
  rows: { runCrewId: string; role: string; joinedAt: Date }[]
): string | null {
  if (rows.length === 0) return null;
  const adminOrManager =
    rows.find((r) => r.role === "admin") ?? rows.find((r) => r.role === "manager");
  if (adminOrManager) return adminOrManager.runCrewId;
  const sorted = [...rows].sort(
    (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  );
  return sorted[0].runCrewId;
}

/** GET /api/me/memberships — run crew memberships + upcoming runs + going RSVPs for home */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let decodedUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    decodedUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const athlete = await getAthleteByFirebaseId(decodedUid);
  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  const now = new Date();

  try {
    const raw = await prisma.run_crew_memberships.findMany({
      where: { athleteId: athlete.id },
      include: {
        run_crews: {
          select: {
            id: true,
            name: true,
            logo: true,
            icon: true,
            description: true,
            city_runs: {
              where: { date: { gte: now } },
              orderBy: { date: "asc" },
              take: 5,
              select: {
                id: true,
                title: true,
                date: true,
                city_run_rsvps: {
                  where: { status: "going" },
                  select: {
                    status: true,
                    Athlete: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photoURL: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const primaryCrewId = pickPrimaryCrewId(
      raw.map((m) => ({
        runCrewId: m.runCrewId,
        role: m.role,
        joinedAt: m.joinedAt,
      }))
    );

    const memberships = raw.map((m) => ({
      membershipId: m.id,
      runCrewId: m.runCrewId,
      role: m.role,
      joinedAt: m.joinedAt,
      runCrew: {
        id: m.run_crews.id,
        name: m.run_crews.name,
        logo: m.run_crews.logo,
        icon: m.run_crews.icon,
        description: m.run_crews.description,
        runs: m.run_crews.city_runs.map((r) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          rsvps: r.city_run_rsvps.map((rv) => ({
            status: rv.status,
            athlete: rv.Athlete,
          })),
        })),
      },
    }));

    return NextResponse.json({
      success: true,
      primaryCrewId,
      memberships,
    });
  } catch (err: unknown) {
    console.error("GET /api/me/memberships:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
