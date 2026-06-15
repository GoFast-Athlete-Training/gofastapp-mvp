export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';

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

  const token = await prisma.athlete_push_tokens.upsert({
    where: { expoPushToken },
    create: {
      athleteId: auth.athlete.id,
      expoPushToken,
      platform: body.platform?.trim() || null,
      deviceId: body.deviceId?.trim() || null,
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      athleteId: auth.athlete.id,
      platform: body.platform?.trim() || null,
      deviceId: body.deviceId?.trim() || null,
      enabled: true,
      lastSeenAt: new Date(),
    },
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

  await prisma.athlete_push_tokens.updateMany({
    where: { athleteId: auth.athlete.id, expoPushToken },
    data: { enabled: false },
  });

  return NextResponse.json({ success: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
