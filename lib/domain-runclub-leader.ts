import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  LEADER_RUN_CLUB_UPDATABLE_FIELDS,
  pickLeaderFields,
} from '@/lib/run-club-leader-scope';
import { normalizeInstagramUrl, normalizeStravaUrl, normalizeWebsiteUrl } from '@/lib/runclub-urls';

import { computeSetupCompleteness } from '@/lib/run-club-leader-setup';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function normalizeClubPatch(raw: Record<string, unknown>): Prisma.run_clubsUpdateInput {
  const data: Prisma.run_clubsUpdateInput = { updatedAt: new Date() };

  if (raw.description !== undefined) {
    data.description =
      raw.description == null || String(raw.description).trim() === ''
        ? null
        : String(raw.description).trim();
  }
  if (raw.allRunsDescription !== undefined) {
    data.allRunsDescription =
      raw.allRunsDescription == null || String(raw.allRunsDescription).trim() === ''
        ? null
        : String(raw.allRunsDescription).trim();
  }
  if (raw.websiteUrl !== undefined) {
    data.websiteUrl = normalizeWebsiteUrl(raw.websiteUrl as string | null);
  }
  if (raw.instagramUrl !== undefined) {
    data.instagramUrl = normalizeInstagramUrl(raw.instagramUrl as string | null);
  }
  if (raw.stravaUrl !== undefined) {
    data.stravaUrl = normalizeStravaUrl(raw.stravaUrl as string | null);
  }
  if (raw.logoUrl !== undefined) {
    data.logoUrl =
      raw.logoUrl == null || String(raw.logoUrl).trim() === ''
        ? null
        : String(raw.logoUrl).trim();
  }

  return data;
}

export async function updateRunClubAsLeader(runClubId: string, body: Record<string, unknown>) {
  const patch = pickLeaderFields(body, LEADER_RUN_CLUB_UPDATABLE_FIELDS);
  if (Object.keys(patch).length === 0) {
    throw new Error('No allowed fields to update');
  }

  return prisma.run_clubs.update({
    where: { id: runClubId },
    data: normalizeClubPatch(patch),
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      allRunsDescription: true,
      websiteUrl: true,
      instagramUrl: true,
      stravaUrl: true,
      logoUrl: true,
      city: true,
      state: true,
    },
  });
}

export async function createRunClubAnnouncement(input: {
  runClubId: string;
  authorId: string;
  title?: string | null;
  body: string;
  visibility?: string;
}) {
  const body = input.body.trim();
  if (!body) throw new Error('Announcement body is required');

  return prisma.run_club_announcements.create({
    data: {
      runClubId: input.runClubId,
      authorId: input.authorId,
      title: input.title?.trim() || null,
      body,
      visibility: input.visibility === 'public' ? 'public' : 'members',
    },
    include: {
      Athlete: {
        select: { firstName: true, lastName: true, photoURL: true },
      },
    },
  });
}

export async function updateRunClubAnnouncement(
  announcementId: string,
  runClubId: string,
  patch: { title?: string | null; body?: string; visibility?: string }
) {
  const existing = await prisma.run_club_announcements.findFirst({
    where: { id: announcementId, runClubId },
  });
  if (!existing) return null;

  return prisma.run_club_announcements.update({
    where: { id: announcementId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
      ...(patch.body !== undefined ? { body: patch.body.trim() } : {}),
      ...(patch.visibility !== undefined
        ? { visibility: patch.visibility === 'public' ? 'public' : 'members' }
        : {}),
      updatedAt: new Date(),
    },
  });
}

export async function deleteRunClubAnnouncement(announcementId: string, runClubId: string) {
  const existing = await prisma.run_club_announcements.findFirst({
    where: { id: announcementId, runClubId },
  });
  if (!existing) return false;
  await prisma.run_club_announcements.delete({ where: { id: announcementId } });
  return true;
}

export async function createRunClubEvent(input: {
  runClubId: string;
  creatorId: string;
  title: string;
  description?: string | null;
  eventType?: string;
  startsAt: Date;
  endsAt?: Date | null;
  location?: string | null;
  visibility?: string;
}) {
  const title = input.title.trim();
  if (!title) throw new Error('Event title is required');

  return prisma.run_club_events.create({
    data: {
      runClubId: input.runClubId,
      creatorId: input.creatorId,
      title,
      description: input.description?.trim() || null,
      eventType: input.eventType?.trim() || 'social',
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      location: input.location?.trim() || null,
      visibility: input.visibility === 'members' ? 'members' : 'public',
    },
  });
}

export async function updateRunClubEvent(
  eventId: string,
  runClubId: string,
  patch: {
    title?: string;
    description?: string | null;
    eventType?: string;
    startsAt?: Date;
    endsAt?: Date | null;
    location?: string | null;
    visibility?: string;
  }
) {
  const existing = await prisma.run_club_events.findFirst({
    where: { id: eventId, runClubId },
  });
  if (!existing) return null;

  return prisma.run_club_events.update({
    where: { id: eventId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
      ...(patch.eventType !== undefined ? { eventType: patch.eventType.trim() || 'social' } : {}),
      ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
      ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
      ...(patch.location !== undefined ? { location: patch.location?.trim() || null } : {}),
      ...(patch.visibility !== undefined
        ? { visibility: patch.visibility === 'members' ? 'members' : 'public' }
        : {}),
      updatedAt: new Date(),
    },
  });
}

export async function deleteRunClubEvent(eventId: string, runClubId: string) {
  const existing = await prisma.run_club_events.findFirst({
    where: { id: eventId, runClubId },
  });
  if (!existing) return false;
  await prisma.run_club_events.delete({ where: { id: eventId } });
  return true;
}

export async function getLeaderDashboard(runClubId: string, membershipRole?: string) {
  const now = new Date();
  const [club, series, upcomingRunsRaw, memberCount, announcements, events] = await Promise.all([
    prisma.run_clubs.findUnique({
      where: { id: runClubId },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        city: true,
        state: true,
        description: true,
        allRunsDescription: true,
        websiteUrl: true,
        instagramUrl: true,
        stravaUrl: true,
      },
    }),
    prisma.run_series.findMany({
      where: { runClubId },
      orderBy: { dayOfWeek: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        dayOfWeek: true,
        workflowStatus: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
      },
    }),
    prisma.city_runs.findMany({
      where: { runClubId, date: { gte: now } },
      orderBy: { date: 'asc' },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        workflowStatus: true,
        meetUpPoint: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        _count: { select: { city_run_rsvps: { where: { status: 'going' } } } },
        city_run_rsvps: {
          where: { status: 'going' },
          take: 5,
          select: {
            id: true,
            Athlete: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.run_club_memberships.count({ where: { runClubId, status: 'active' } }),
    prisma.run_club_announcements.findMany({
      where: { runClubId },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),
    prisma.run_club_events.findMany({
      where: { runClubId, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      take: 10,
    }),
  ]);

  const upcomingRuns = upcomingRunsRaw.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    date: r.date.toISOString(),
    workflowStatus: r.workflowStatus,
    meetUpPoint: r.meetUpPoint,
    startTimeHour: r.startTimeHour,
    startTimeMinute: r.startTimeMinute,
    startTimePeriod: r.startTimePeriod,
    rsvpCount: r._count.city_run_rsvps,
    rsvps: r.city_run_rsvps.map((rsvp) => ({
      id: rsvp.id,
      athlete: rsvp.Athlete,
    })),
  }));

  const runsNeedReview = upcomingRuns.filter(
    (r) => r.workflowStatus !== 'APPROVED' && r.workflowStatus !== 'SUBMITTED'
  ).length;

  const setup = club
    ? computeSetupCompleteness({
        club,
        seriesCount: series.length,
        upcomingRunCount: upcomingRuns.length,
        runsNeedReview,
      })
    : null;

  const writeScope = club
    ? {
        runClubId: club.id,
        runClubSlug: club.slug,
        membershipRole: membershipRole ?? 'admin',
      }
    : null;

  return {
    club,
    writeScope,
    setup,
    series,
    upcomingRuns,
    memberCount,
    announcementsSummary: {
      count: announcements.length,
      latest: announcements[0]
        ? {
            id: announcements[0].id,
            title: announcements[0].title,
            body: announcements[0].body,
            publishedAt: announcements[0].publishedAt.toISOString(),
          }
        : null,
    },
    announcements,
    eventsSummary: {
      count: events.length,
      next: events[0]
        ? {
            id: events[0].id,
            title: events[0].title,
            startsAt: events[0].startsAt.toISOString(),
          }
        : null,
    },
    events: events.map((e) => ({
      ...e,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt?.toISOString() ?? null,
    })),
    invites: {
      enabled: false,
      label: 'Invite people to your container',
      description: 'Coming in MVP2 — grow your club membership from GoFast.',
    },
  };
}

export { generateId };
