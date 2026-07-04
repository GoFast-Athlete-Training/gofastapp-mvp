export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  disableAppNotificationDevice,
  upsertAppNotificationDevice,
} from '@/lib/app-notifications/devices';

/** POST /api/me/push-tokens — upsert Expo push token for current athlete */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { expoPushToken?: string; platform?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const expoPushToken = body.expoPushToken?.trim();
  if (!expoPushToken) {
    return NextResponse.json({ error: 'expoPushToken is required' }, { status: 400 });
  }

  const token = await upsertAppNotificationDevice({
    athleteId: auth.athlete.id,
    expoPushToken,
    platform: body.platform,
    deviceId: body.deviceId,
  });

  console.info('[push-tokens] registered', {
    athleteId: auth.athlete.id,
    platform: body.platform ?? 'unknown',
    tokenPrefix: `${expoPushToken.slice(0, 24)}…`,
    tokenId: token.id,
  });

  return NextResponse.json({ success: true, tokenId: token.id });
}

/** DELETE /api/me/push-tokens — disable token on logout */
export async function DELETE(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { expoPushToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const expoPushToken = body.expoPushToken?.trim();
  if (!expoPushToken) {
    return NextResponse.json({ error: 'expoPushToken is required' }, { status: 400 });
  }

  await disableAppNotificationDevice({
    athleteId: auth.athlete.id,
    expoPushToken,
  });

  return NextResponse.json({ success: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
