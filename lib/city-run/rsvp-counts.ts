import prisma from "@/lib/prisma";
import { isAttendingCityRunRsvp } from "@/lib/city-run/rsvp-attendance";
import { RSVP_ROLE_HOST } from "@/lib/city-run/rsvp-role";

export type CityRunRsvpCounts = {
  going: number;
  hosts: number;
  totalAttending: number;
};

export async function getCityRunRsvpCounts(runId: string): Promise<CityRunRsvpCounts> {
  const rows = await prisma.city_run_rsvps.findMany({
    where: { runId },
    select: { status: true, role: true },
  });
  let going = 0;
  let hosts = 0;
  for (const r of rows) {
    if (!isAttendingCityRunRsvp(r)) continue;
    if (r.role === RSVP_ROLE_HOST) hosts += 1;
    else going += 1;
  }
  return { going, hosts, totalAttending: going + hosts };
}
