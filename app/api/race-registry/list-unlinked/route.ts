import { NextRequest } from "next/server";
import { raceRegistryUnlinkedListGET } from "@/lib/server/race-registry-unlinked-list";

export const dynamic = "force-dynamic";

/**
 * @deprecated Prefer GET /api/race-registry/sync/unlinked — this path can be
 * incorrectly handled as /api/race-registry/[id] with id=list-unlinked in some setups.
 */
export async function GET(request: NextRequest) {
  return raceRegistryUnlinkedListGET(request);
}
