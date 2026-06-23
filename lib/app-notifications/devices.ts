import { prisma } from '@/lib/prisma';

export async function upsertAppNotificationDevice(params: {
  athleteId: string;
  expoPushToken: string;
  platform?: string | null;
  deviceId?: string | null;
}): Promise<{ id: string }> {
  const token = await prisma.athlete_appnotification_devices.upsert({
    where: { expoPushToken: params.expoPushToken },
    create: {
      athleteId: params.athleteId,
      expoPushToken: params.expoPushToken,
      platform: params.platform?.trim() || null,
      deviceId: params.deviceId?.trim() || null,
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      athleteId: params.athleteId,
      platform: params.platform?.trim() || null,
      deviceId: params.deviceId?.trim() || null,
      enabled: true,
      lastSeenAt: new Date(),
    },
    select: { id: true },
  });
  return token;
}

export async function disableAppNotificationDevice(params: {
  athleteId: string;
  expoPushToken: string;
}): Promise<void> {
  await prisma.athlete_appnotification_devices.updateMany({
    where: { athleteId: params.athleteId, expoPushToken: params.expoPushToken },
    data: { enabled: false },
  });
}

export async function getEnabledDeviceTokens(athleteId: string): Promise<string[]> {
  const rows = await prisma.athlete_appnotification_devices.findMany({
    where: { athleteId, enabled: true },
    select: { expoPushToken: true },
  });
  return rows.map((r) => r.expoPushToken);
}
