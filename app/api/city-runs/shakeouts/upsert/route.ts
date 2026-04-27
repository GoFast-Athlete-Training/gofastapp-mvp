import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL || "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function generateCityRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function utcTo12h(d: Date): { hour: number; minute: number; period: string } {
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { hour: h12, minute: m, period };
}

type ShakeoutIn = {
  companyEventId?: string;
  windowIndex?: number;
  runAtIso?: string;
  title?: string;
  meetUpPoint?: string;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | null;
  meetUpLng?: number | null;
  totalMiles?: number | null;
  pace?: string | null;
  description?: string | null;
  postRunActivity?: string | null;
};

/**
 * POST /api/city-runs/shakeouts/upsert
 * Company prodpush: upsert `city_runs` for each (race_registry × shakeout window).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const companyRaceId =
      typeof body.companyRaceId === "string" && body.companyRaceId.trim()
        ? body.companyRaceId.trim()
        : "";
    if (!companyRaceId) {
      return NextResponse.json(
        { success: false, error: "companyRaceId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const gofastCity =
      typeof body.gofastCity === "string" && body.gofastCity.trim()
        ? body.gofastCity.trim().toLowerCase()
        : "unknown";

    const runClubIdRaw = body.runClubId;
    let runClubId: string | null =
      runClubIdRaw != null && String(runClubIdRaw).trim()
        ? String(runClubIdRaw).trim()
        : null;
    if (runClubId) {
      const club = await prisma.run_clubs.findUnique({
        where: { id: runClubId },
        select: { id: true },
      });
      if (!club) runClubId = null;
    }

    const shakeoutsIn = Array.isArray(body.shakeouts) ? body.shakeouts : [];
    if (shakeoutsIn.length === 0) {
      return NextResponse.json(
        { success: false, error: "shakeouts array is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const registries = await prisma.race_registry.findMany({
      where: { companyRaceId, isActive: true },
      select: { id: true },
    });

    if (registries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No race_registry rows for this companyRaceId. Prodpush race registrations first.",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    let synced = 0;
    const results: Array<{ dedupeKey: string; cityRunId: string }> = [];

    for (const reg of registries) {
      for (const raw of shakeoutsIn as ShakeoutIn[]) {
        const companyEventId =
          typeof raw.companyEventId === "string" && raw.companyEventId.trim()
            ? raw.companyEventId.trim()
            : "";
        const windowIndex =
          typeof raw.windowIndex === "number" && Number.isFinite(raw.windowIndex)
            ? raw.windowIndex
            : 0;
        if (!companyEventId) continue;

        const runAtIso =
          typeof raw.runAtIso === "string" && raw.runAtIso.trim()
            ? raw.runAtIso.trim()
            : "";
        const runAt = runAtIso ? new Date(runAtIso) : null;
        if (!runAt || Number.isNaN(runAt.getTime())) continue;

        const dedupeKey = `shk-${reg.id}-${companyEventId}-w${windowIndex}`;
        const title =
          typeof raw.title === "string" && raw.title.trim()
            ? raw.title.trim().slice(0, 200)
            : "Shakeout";
        const meetUpPoint =
          typeof raw.meetUpPoint === "string" && raw.meetUpPoint.trim()
            ? raw.meetUpPoint.trim().slice(0, 500)
            : "Shakeout meetup";

        const { hour, minute, period } = utcTo12h(runAt);

        const existing = await prisma.city_runs.findFirst({
          where: { shakeoutDedupeKey: dedupeKey },
        });

        const common = {
          title,
          date: runAt,
          meetUpPoint,
          meetUpPlaceId:
            raw.meetUpPlaceId != null && String(raw.meetUpPlaceId).trim()
              ? String(raw.meetUpPlaceId).trim()
              : null,
          meetUpLat:
            raw.meetUpLat != null && Number.isFinite(raw.meetUpLat)
              ? raw.meetUpLat
              : null,
          meetUpLng:
            raw.meetUpLng != null && Number.isFinite(raw.meetUpLng)
              ? raw.meetUpLng
              : null,
          totalMiles:
            raw.totalMiles != null && Number.isFinite(raw.totalMiles)
              ? raw.totalMiles
              : null,
          pace: raw.pace != null && String(raw.pace).trim() ? String(raw.pace).trim() : null,
          description:
            raw.description != null && String(raw.description).trim()
              ? String(raw.description).trim()
              : null,
          postRunActivity:
            raw.postRunActivity != null && String(raw.postRunActivity).trim()
              ? String(raw.postRunActivity).trim()
              : null,
          startTimeHour: hour,
          startTimeMinute: minute,
          startTimePeriod: period,
          gofastCity,
          raceRegistryId: reg.id,
          runClubId,
          runSeriesId: null,
          workflowStatus: "DEVELOP" as const,
          shakeoutDedupeKey: dedupeKey,
          updatedAt: new Date(),
        };

        if (existing) {
          await prisma.city_runs.update({
            where: { id: existing.id },
            data: common,
          });
          results.push({ dedupeKey, cityRunId: existing.id });
        } else {
          const id = generateCityRunId();
          await prisma.city_runs.create({
            data: {
              id,
              ...common,
            },
          });
          results.push({ dedupeKey, cityRunId: id });
        }
        synced++;
      }
    }

    /**
     * Company `replaceRaceRunEvents` recreates `race_run_event` rows with new IDs on every save.
     * Dedupe keys include that id (`shk-{regId}-{companyEventId}-w{i}`), so old `city_runs` ghosts
     * would never match `findFirst` and would accumulate. After each successful upsert batch,
     * delete shakeout rows for this registry whose key is not in the current batch.
     */
    let pruned = 0;
    for (const reg of registries) {
      const prefix = `shk-${reg.id}-`;
      const keysForReg = results
        .filter((r) => r.dedupeKey.startsWith(prefix))
        .map((r) => r.dedupeKey);

      if (keysForReg.length > 0) {
        const del = await prisma.city_runs.deleteMany({
          where: {
            raceRegistryId: reg.id,
            AND: [
              { shakeoutDedupeKey: { not: null } },
              { shakeoutDedupeKey: { notIn: keysForReg } },
            ],
          },
        });
        pruned += del.count;
      } else {
        const del = await prisma.city_runs.deleteMany({
          where: {
            raceRegistryId: reg.id,
            shakeoutDedupeKey: { not: null },
          },
        });
        pruned += del.count;
      }
    }

    const response = NextResponse.json({
      success: true,
      synced,
      pruned,
      results,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[city-runs/shakeouts/upsert]", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Failed to upsert shakeouts" },
      { status: 500, headers: corsHeaders }
    );
  }
}
