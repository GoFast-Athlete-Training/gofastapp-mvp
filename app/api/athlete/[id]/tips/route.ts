export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import {
  listAthleteTipsForOwner,
  mapAthleteTip,
  normalizeTipInput,
} from '@/lib/gofast-with-me/athlete-tips';

const MAX_TITLE = 120;
const MAX_BODY = 8000;

async function requireOwnedAthlete(request: Request, athleteId: string) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 }) };
  }

  const athlete = await getAthleteById(athleteId);
  if (!athlete) {
    return { error: NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 }) };
  }
  if (athlete.firebaseId !== decodedToken.uid) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { athlete };
}

function validateTip(title: string, body: string) {
  if (!title) return 'Title is required';
  if (title.length > MAX_TITLE) return `Title too long (max ${MAX_TITLE})`;
  if (!body) return 'Body is required';
  if (body.length > MAX_BODY) return `Body too long (max ${MAX_BODY})`;
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Missing athlete id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const tips = await listAthleteTipsForOwner(athleteId);
    return NextResponse.json({ success: true, tips });
  } catch (e) {
    console.error('athlete/tips GET:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    if (!athleteId) {
      return NextResponse.json({ success: false, error: 'Missing athlete id' }, { status: 400 });
    }

    const auth = await requireOwnedAthlete(request, athleteId);
    if ('error' in auth) return auth.error;

    const input = normalizeTipInput(await request.json().catch(() => ({})));
    const validationError = validateTip(input.title, input.body);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const created = await prisma.athlete_tips.create({
      data: {
        athleteId,
        title: input.title,
        body: input.body,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        sortOrder: input.sortOrder,
        isPublished: input.isPublished,
        publishedAt: input.isPublished ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, tip: mapAthleteTip(created) });
  } catch (e) {
    console.error('athlete/tips POST:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
