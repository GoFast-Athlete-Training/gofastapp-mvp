import { prisma } from '@/lib/prisma';
import { buildClubRunReminderCopy } from '@/lib/city-run-copy';
import { sendAppNotification } from '@/lib/app-notifications/send';
import type { NotificationTemplateKey } from '@/lib/app-notifications/types';

const HOUR_MS = 60 * 60 * 1000;

export type ClubRunReminderKind = 'tomorrow' | 'today';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function processClubRunReminders(now = new Date()) {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const dayAfterTomorrow = addUtcDays(todayStart, 2);

  const rsvps = await prisma.city_run_rsvps.findMany({
    where: {
      status: 'going',
      city_runs: {
        cityRunType: 'CLUB',
        date: { gte: todayStart, lt: dayAfterTomorrow },
      },
    },
    include: {
      city_runs: {
        select: {
          id: true,
          date: true,
          runClub: {
            select: { id: true, slug: true, name: true, logoUrl: true, city: true },
          },
        },
      },
    },
  });

  let notificationsUpserted = 0;
  let pushesSent = 0;

  for (const rsvp of rsvps) {
    const run = rsvp.city_runs;
    if (!run) continue;

    const runDay = startOfUtcDay(run.date);
    let kind: ClubRunReminderKind | null = null;
    if (runDay.getTime() === tomorrowStart.getTime()) kind = 'tomorrow';
    else if (runDay.getTime() === todayStart.getTime()) kind = 'today';
    if (!kind) continue;

    const existingCheckin = await prisma.city_run_checkins.findUnique({
      where: { runId_athleteId: { runId: run.id, athleteId: rsvp.athleteId } },
    });
    if (existingCheckin) continue;

    const copy = buildClubRunReminderCopy(run.runClub, kind);
    const templateKey: NotificationTemplateKey =
      kind === 'today' ? 'clubRun.today' : 'clubRun.tomorrow';
    const deeplink = `/gorun/${run.id}`;

    const result = await sendAppNotification({
      athleteId: rsvp.athleteId,
      templateKey,
      objectType: 'city_run',
      objectId: run.id,
      deeplink,
      payload: { runId: run.id, reminderKind: kind },
      facts: {
        clubName: run.runClub?.name ?? 'Club run',
        body: copy.body,
      },
    });

    notificationsUpserted += 1;
    pushesSent += result.pushesSent;
  }

  return { notificationsUpserted, pushesSent, candidates: rsvps.length };
}

export async function getUpcomingClubRunReminderForAthlete(
  athleteId: string,
  now = new Date()
) {
  const horizon = new Date(now.getTime() + 48 * HOUR_MS);
  const rsvp = await prisma.city_run_rsvps.findFirst({
    where: {
      athleteId,
      status: 'going',
      city_runs: {
        cityRunType: 'CLUB',
        date: { gt: now, lte: horizon },
        city_run_checkins: { none: { athleteId } },
      },
    },
    orderBy: { city_runs: { date: 'asc' } },
    include: {
      city_runs: {
        select: {
          id: true,
          title: true,
          date: true,
          runClub: {
            select: { id: true, slug: true, name: true, logoUrl: true, city: true },
          },
        },
      },
    },
  });

  if (!rsvp?.city_runs) return null;

  const run = rsvp.city_runs;
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);
  const runDay = startOfUtcDay(run.date);

  let reminderKind: ClubRunReminderKind = 'today';
  if (runDay.getTime() === tomorrowStart.getTime()) reminderKind = 'tomorrow';
  else if (runDay.getTime() > tomorrowStart.getTime()) return null;

  const copy = buildClubRunReminderCopy(run.runClub, reminderKind);

  return {
    runId: run.id,
    runTitle: run.title,
    runDate: run.date.toISOString(),
    runClub: run.runClub,
    reminderKind,
    title: copy.title,
    body: copy.body,
    deeplink: `/gorun/${run.id}`,
  };
}
