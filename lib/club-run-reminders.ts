import { prisma } from '@/lib/prisma';
import { buildClubRunReminderCopy } from '@/lib/city-run-copy';
import { sendExpoPushBatch } from '@/lib/expo-push';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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
      Athlete: {
        select: {
          id: true,
          athlete_push_tokens: {
            where: { enabled: true },
            select: { expoPushToken: true },
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
    const dedupeKey = `club_run_${kind}:${run.id}:${rsvp.athleteId}`;
    const deeplink = `/gorun/${run.id}`;

    await prisma.athlete_notifications.upsert({
      where: { dedupeKey },
      create: {
        athleteId: rsvp.athleteId,
        type: `club_run_${kind}`,
        title: copy.title,
        body: copy.body,
        deeplink,
        scheduledFor: now,
        dedupeKey,
        payload: { runId: run.id, reminderKind: kind },
      },
      update: {
        title: copy.title,
        body: copy.body,
        deeplink,
        scheduledFor: now,
        payload: { runId: run.id, reminderKind: kind },
      },
    });
    notificationsUpserted += 1;

    const tokens = rsvp.Athlete.athlete_push_tokens.map((t) => t.expoPushToken);
    if (tokens.length === 0) continue;

    const notification = await prisma.athlete_notifications.findUnique({
      where: { dedupeKey },
      select: { id: true, sentAt: true },
    });
    if (notification?.sentAt) continue;

    const sent = await sendExpoPushBatch(tokens, {
      title: copy.title,
      body: copy.body,
      data: { runId: run.id, deeplink },
    });

    if (sent > 0 && notification) {
      await prisma.athlete_notifications.update({
        where: { id: notification.id },
        data: { sentAt: now },
      });
      pushesSent += sent;
    }
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
