import { NextRequest } from "next/server";
import { raceRegistryUnlinkedListGET } from "@/lib/server/race-registry-unlinked-list";

export const dynamic = "force-dynamic";

/**
 * GET /api/race-registry/sync/unlinked
 * GoFastCompany → MVP server-to-server (Bearer RACE_UPSTREAM_SECRET).
 * Lives under /sync/ so this route is never captured by /api/race-registry/[id]
 * (which treated "list-unlinked" as an id and returned 400 — missing x-athlete-id).
 */
export async function GET(request: NextRequest) {
  return raceRegistryUnlinkedListGET(request);
}
