export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  followAthleteBySlug,
  isFollowingHost,
  resolveFollowTargetBySlug,
} from '@/lib/gofast-with-me/follow-service';

type RouteParams = { handle: string };

/** GET /api/follow/[handle] — public target + optional caller follow status */
export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { handle } = await params;
    const target = await resolveFollowTargetBySlug(handle);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const displayName =
      [target.firstName, target.lastName].filter(Boolean).join(' ') ||
      (target.gofastHandle ? `@${target.gofastHandle}` : 'Runner');

    let isFollowing = false;
    let isSelf = false;

    const auth = await requireAthleteFromBearer(request);
    if (!('error' in auth)) {
      isSelf = auth.athlete.id === target.hostAthleteId;
      if (!isSelf) {
        isFollowing = await isFollowingHost(target.hostAthleteId, auth.athlete.id);
      }
    }

    return NextResponse.json({
      success: true,
      target: {
        hostAthleteId: target.hostAthleteId,
        slug: target.gofastSlugSnapshot,
        displayName,
        firstName: target.firstName,
        gofastHandle: target.gofastHandle,
      },
      isFollowing,
      isSelf,
    });
  } catch (e) {
    console.error('GET /api/follow/[handle]', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

/** POST /api/follow/[handle] — authenticated follow (upserts container membership) */
export async function POST(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { handle } = await params;
    const result = await followAthleteBySlug(handle, auth.athlete.id);

    return NextResponse.json({
      success: true,
      hostAthleteId: result.hostAthleteId,
      slug: result.slug,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error('POST /api/follow/[handle]', e);
    const status =
      msg.includes('not found') || msg.includes('Not found') ? 404 : msg.includes('yourself') ? 400 : 400;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
