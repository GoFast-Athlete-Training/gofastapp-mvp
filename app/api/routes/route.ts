import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

export const dynamic = "force-dynamic";

/**
 * GET /api/routes?q=&gofastCity=
 * Search saved routes: authenticated user's routes OR routes in gofastCity (when city filter set).
 */
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") || "").trim();
    const gofastCity = (request.nextUrl.searchParams.get("gofastCity") || "").trim();

    if (!q || q.length < 1) {
      return NextResponse.json(
        { success: false, error: "Query q is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");
    let athleteId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const auth = await requireAthleteFromBearer(request);
      if (!("error" in auth)) {
        athleteId = auth.athlete.id;
      }
    }

    const nameFilter = { contains: q, mode: "insensitive" as const };

    let where: Prisma.routesWhereInput;

    if (athleteId) {
      where = {
        name: nameFilter,
        OR: [
          { createdByAthleteId: athleteId },
          ...(gofastCity ? [{ gofastCity: gofastCity }] : []),
        ],
      };
    } else if (gofastCity) {
      where = {
        name: nameFilter,
        gofastCity: gofastCity,
      };
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Provide Authorization or gofastCity for route search",
        },
        { status: 400 }
      );
    }

    const routes = await prisma.routes.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        stravaUrl: true,
        distanceMiles: true,
        stravaMapUrl: true,
        mapImageUrl: true,
        routePhotos: true,
        routeNeighborhood: true,
        runType: true,
        gofastCity: true,
      },
    });

    return NextResponse.json({ success: true, routes });
  } catch (error: any) {
    console.error("GET /api/routes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search routes", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routes
 * Create a saved route (Firebase auth).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const route = await prisma.routes.create({
      data: {
        name,
        stravaUrl: typeof body.stravaUrl === "string" ? body.stravaUrl.trim() || null : null,
        distanceMiles:
          body.distanceMiles != null && body.distanceMiles !== ""
            ? parseFloat(String(body.distanceMiles))
            : null,
        stravaMapUrl: typeof body.stravaMapUrl === "string" ? body.stravaMapUrl.trim() || null : null,
        mapImageUrl: typeof body.mapImageUrl === "string" ? body.mapImageUrl.trim() || null : null,
        routePhotos:
          Array.isArray(body.routePhotos) && body.routePhotos.length > 0
            ? (body.routePhotos as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        routeNeighborhood:
          typeof body.routeNeighborhood === "string" ? body.routeNeighborhood.trim() || null : null,
        runType: typeof body.runType === "string" ? body.runType.trim() || null : null,
        gofastCity: typeof body.gofastCity === "string" ? body.gofastCity.trim() || null : null,
        createdByAthleteId: athlete.id,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, route });
  } catch (error: any) {
    console.error("POST /api/routes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create route", details: error?.message },
      { status: 500 }
    );
  }
}
