import { prisma } from './prisma';

export async function updateGarminConnection(
  athleteId: string,
  data: {
    garmin_user_id: string;
    garmin_access_token: string;
    garmin_refresh_token: string;
    garmin_expires_in: number;
    garmin_scope?: string;
  }
) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      ...data,
      garmin_is_connected: true,
      garmin_connected_at: new Date(),
    },
  });
}

export async function disconnectGarmin(athleteId: string) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data: {
      garmin_is_connected: false,
      garmin_disconnected_at: new Date(),
      garmin_access_token: null,
      garmin_refresh_token: null,
    },
  });
}

export async function getGarminConnection(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_is_connected: true,
      garmin_user_id: true,
      garmin_connected_at: true,
    },
  });

  return athlete;
}

