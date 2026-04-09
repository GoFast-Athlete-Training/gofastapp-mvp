import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SECRET_ENV = "GOFAST_INTERNAL_RACE_HUB_SECRET";

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return m ? m[1]!.trim() : null;
}

/** Returns a NextResponse when the request must be rejected; null when authorized. */
export function requireInternalRaceHubSecret(request: Request): NextResponse | null {
  const configured = process.env[SECRET_ENV];
  if (!configured?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: `${SECRET_ENV} is not configured on this server`,
      },
      { status: 503 }
    );
  }

  const headerSecret =
    request.headers.get("x-gofast-internal-secret")?.trim() ??
    getBearerToken(request) ??
    "";
  if (!headerSecret || headerSecret !== configured.trim()) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}

export function requireStaffAuthorEnv(): NextResponse | null {
  const id = process.env.RACE_HUB_STAFF_AUTHOR_ATHLETE_ID?.trim();
  if (!id) {
    return NextResponse.json(
      {
        success: false,
        error: "RACE_HUB_STAFF_AUTHOR_ATHLETE_ID is not configured on this server",
      },
      { status: 503 }
    );
  }
  return null;
}

/**
 * Resolve active race_registry for GoFastCompany races.id (companyRaceId).
 * Same lookup intent as public resolve-by-company-race, with id fallback like race-registry/update.
 */
export async function resolveActiveRaceByCompanyRaceId(companyRaceId: string) {
  const id = companyRaceId.trim();
  let race = await prisma.race_registry.findFirst({
    where: {
      companyRaceId: id,
      isActive: true,
      isCancelled: false,
    },
  });
  if (!race) {
    race = await prisma.race_registry.findFirst({
      where: {
        id,
        isActive: true,
        isCancelled: false,
      },
    });
  }
  return race;
}
