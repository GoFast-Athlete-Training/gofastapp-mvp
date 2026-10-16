import prisma from "@/lib/prisma";
import { getAthleteHostedRunInviteForHost } from "@/lib/city-run/list-athlete-hosted-invites";

/** Host deletes their created invite and planId-null RSVP stamps for that city run. */
export async function deleteAthleteHostedRunInvite(
  athleteId: string,
  cityRunId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const invite = await getAthleteHostedRunInviteForHost(athleteId, cityRunId);
  if (!invite) {
    return { ok: false, status: 404, error: "Run invite not found" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.planned_workouts.deleteMany({
      where: {
        athleteId,
        cityRunId,
        planId: null,
      },
    });
    await tx.city_runs.delete({ where: { id: cityRunId } });
  });

  return { ok: true };
}
