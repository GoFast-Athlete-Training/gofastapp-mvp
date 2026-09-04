import { prisma } from '@/lib/prisma';
import { buildCityRunMatchLabel } from '@/lib/city-run/match-label';

export type AttendedClubRunPayload = {
  id: string;
  runId: string;
  title: string;
  label: string;
  checkedInAt: string;
  meetUpPoint: string | null;
};

const HOSTED_RUN_TYPES = new Set(['CLUB', 'INDIVIDUAL', 'RUN_CREW']);

/** Recent club/city runs the host checked in to (e.g. DCCR Thurs Tempo). */
export async function listAttendedClubRunsForHost(
  athleteId: string,
  limit = 20
): Promise<AttendedClubRunPayload[]> {
  const checkins = await prisma.city_run_checkins.findMany({
    where: { athleteId },
    orderBy: { checkedInAt: 'desc' },
    take: limit,
    include: {
      city_runs: {
        select: {
          id: true,
          title: true,
          date: true,
          meetUpPoint: true,
          dayOfWeek: true,
          cityRunType: true,
          runClub: {
            select: {
              matchToken: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return checkins
    .filter((row) => HOSTED_RUN_TYPES.has(String(row.city_runs.cityRunType)))
    .map((row) => {
      const run = row.city_runs;
      const label = run.runClub
        ? buildCityRunMatchLabel({
            club: run.runClub,
            dayOfWeek: run.dayOfWeek,
            runDate: run.date,
            workoutTitle: run.title,
          })
        : run.title.trim() || 'Run';
      return {
        id: row.id,
        runId: run.id,
        title: run.title,
        label,
        checkedInAt: row.checkedInAt.toISOString(),
        meetUpPoint: run.meetUpPoint,
      };
    });
}
