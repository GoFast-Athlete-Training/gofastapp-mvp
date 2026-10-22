import { prisma } from "@/lib/prisma";

export async function assertAthleteHostsIndividualCityRun(
  athleteId: string,
  cityRunId: string,
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const run = await prisma.city_runs.findUnique({
    where: { id: cityRunId.trim() },
    select: { athleteGeneratedId: true, cityRunType: true },
  });
  if (!run) {
    return { ok: false, status: 404, error: "Run not found" };
  }
  if (run.cityRunType !== "INDIVIDUAL" || run.athleteGeneratedId !== athleteId) {
    return { ok: false, status: 403, error: "You can only edit runs you host" };
  }
  return { ok: true };
}
