import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebaseAdmin";

/** GoFastCompany → MVP: identifies staff row (audit / proxy path). */
export const COMPANY_STAFF_ID_HEADER = "x-company-staff-id";
export const COMPANY_ID_HEADER = "x-company-id";

function verifyRaceUpstreamSecret(request: NextRequest): boolean {
  const secret = process.env.RACE_UPSTREAM_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const header = request.headers.get("x-race-sync-secret")?.trim();
  return bearer === secret || header === secret;
}

function verifyTrainingEngineSecret(request: NextRequest): boolean {
  const expected = process.env.GOFAST_TRAINING_ENGINE_SECRET?.trim();
  if (!expected) return false;
  const got = request.headers.get("x-gofast-training-engine-secret")?.trim();
  return got === expected;
}

/**
 * Same pattern as run-series proxy: Company forwards staff Firebase ID token plus
 * staff/company id headers (already verified on Company).
 */
async function verifyStaffFirebaseProxy(
  request: NextRequest
): Promise<boolean> {
  const auth = request.headers.get("authorization");
  const staffId = request.headers.get(COMPANY_STAFF_ID_HEADER)?.trim();
  const companyId = request.headers.get(COMPANY_ID_HEADER)?.trim();
  if (!auth?.startsWith("Bearer ") || !staffId || !companyId) return false;
  try {
    await adminAuth.verifyIdToken(auth.slice(7));
    return true;
  } catch {
    return false;
  }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (verifyRaceUpstreamSecret(request)) return true;
  if (verifyTrainingEngineSecret(request)) return true;
  if (await verifyStaffFirebaseProxy(request)) return true;
  return false;
}

/**
 * Server-to-server: list race_registry rows with companyRaceId null.
 *
 * Auth (any one):
 * - RACE_UPSTREAM_SECRET via Bearer or x-race-sync-secret
 * - GOFAST_TRAINING_ENGINE_SECRET via x-gofast-training-engine-secret (training proxy pattern)
 * - Staff proxy: Authorization Firebase ID token + x-company-staff-id + x-company-id (run-series style)
 */
export async function raceRegistryUnlinkedListGET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const races = await prisma.race_registry.findMany({
      where: { companyRaceId: null },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        raceDate: true,
        registrationUrl: true,
        officialWebsiteUrl: true,
        distanceMiles: true,
        raceType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, races });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("race-registry unlinked list:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list unlinked registry races",
        details: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
