/**
 * Match a parsed FIT activity to an existing athlete_activities row.
 */

import { prisma } from "../prisma";

const START_TIME_MATCH_WINDOW_MS = 120_000;

export async function findActivityRowForFit(params: {
  athleteId: string;
  sourceActivityId?: string | null;
  sessionStartTimeInSeconds?: number | null;
}): Promise<{ id: string; sourceActivityId: string } | null> {
  const candidateId = params.sourceActivityId?.trim();
  if (candidateId) {
    const byId = await prisma.athlete_activities.findFirst({
      where: { athleteId: params.athleteId, sourceActivityId: candidateId },
      select: { id: true, sourceActivityId: true },
    });
    if (byId) return byId;
  }

  const sessionStart = params.sessionStartTimeInSeconds;
  if (sessionStart == null) return null;

  const center = new Date(sessionStart * 1000);
  const row = await prisma.athlete_activities.findFirst({
    where: {
      athleteId: params.athleteId,
      startTime: {
        gte: new Date(center.getTime() - START_TIME_MATCH_WINDOW_MS),
        lte: new Date(center.getTime() + START_TIME_MATCH_WINDOW_MS),
      },
    },
    orderBy: { startTime: "asc" },
    select: { id: true, sourceActivityId: true },
  });
  return row;
}
