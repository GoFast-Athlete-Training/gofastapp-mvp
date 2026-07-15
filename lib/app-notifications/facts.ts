import { prisma } from '@/lib/prisma';
import { buildClubRunReminderCopy } from '@/lib/city-run-copy';
import type {
  AppNotificationObjectType,
  NotificationTemplateKey,
  TemplateFacts,
} from '@/lib/app-notifications/types';

function formatDistanceMi(meters: number | null | undefined): string | null {
  if (meters == null || meters <= 0) return null;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

/** Load render facts from source objects for template rendering. */
export async function loadNotificationFacts(params: {
  athleteId: string;
  templateKey: NotificationTemplateKey;
  objectType: AppNotificationObjectType;
  objectId: string;
  payload?: Record<string, unknown> | null;
}): Promise<TemplateFacts | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: { firstName: true },
  });
  const firstName = athlete?.firstName ?? 'there';

  switch (params.templateKey) {
    case 'workout.tomorrow': {
      const workout = await prisma.workouts.findFirst({
        where: { id: params.objectId, athleteId: params.athleteId },
        select: {
          title: true,
          estimatedDistanceInMeters: true,
          scheduledStartTimeLabel: true,
        },
      });
      if (!workout) return null;
      const distanceMi = formatDistanceMi(workout.estimatedDistanceInMeters);
      const timePart = workout.scheduledStartTimeLabel?.trim() || null;
      const detail = [distanceMi, timePart].filter(Boolean).join(' · ');
      return {
        firstName,
        workoutTitle: workout.title,
        distanceMi: detail || distanceMi,
      };
    }
    case 'scheduledRun.tomorrow': {
      const workout = await prisma.workouts.findFirst({
        where: { id: params.objectId, athleteId: params.athleteId },
        select: {
          title: true,
          estimatedDistanceInMeters: true,
          scheduledStartTimeLabel: true,
        },
      });
      if (!workout) return null;
      const distancePart = formatDistanceMi(workout.estimatedDistanceInMeters);
      const timePart = workout.scheduledStartTimeLabel?.trim() || null;
      const detail = [distancePart, timePart].filter(Boolean).join(' · ');
      return {
        firstName,
        runTitle: workout.title,
        detail: detail || undefined,
      };
    }
    case 'clubRun.today':
    case 'clubRun.tomorrow': {
      const run = await prisma.city_runs.findUnique({
        where: { id: params.objectId },
        select: {
          runClub: {
            select: { name: true },
          },
        },
      });
      if (!run) return null;
      const kind = params.templateKey === 'clubRun.today' ? 'today' : 'tomorrow';
      const copy = buildClubRunReminderCopy(run.runClub, kind);
      return {
        clubName: run.runClub?.name ?? 'Club run',
        body: copy.body,
      };
    }
    case 'club.chatter': {
      if (params.payload) {
        return {
          clubName: params.payload.clubName ?? 'Run club',
          excerpt: params.payload.excerpt ?? 'said something',
        };
      }
      const club = await prisma.run_clubs.findUnique({
        where: { id: params.objectId },
        select: { name: true },
      });
      if (!club) return null;
      return {
        clubName: club.name,
        excerpt: 'said something in the club chat',
      };
    }
    case 'crew.announcement': {
      const announcement = await prisma.run_crew_announcements.findUnique({
        where: { id: params.objectId },
        select: {
          title: true,
          content: true,
          run_crews: { select: { name: true } },
        },
      });
      if (!announcement) return null;
      const excerpt =
        announcement.content.trim().length > 120
          ? `${announcement.content.trim().slice(0, 117)}...`
          : announcement.content.trim();
      return {
        crewName: announcement.run_crews.name,
        announcementTitle: announcement.title,
        excerpt,
      };
    }
    case 'workout.complete': {
      const workout = await prisma.workouts.findFirst({
        where: { id: params.objectId, athleteId: params.athleteId },
        select: { title: true },
      });
      if (!workout) return null;
      return { workoutTitle: workout.title };
    }
    default:
      return params.payload ?? null;
  }
}
