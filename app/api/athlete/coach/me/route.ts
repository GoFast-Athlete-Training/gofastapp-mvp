export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  ensureAthleteCoachProfile,
  loadAthleteCoachEditorPayload,
  type AthleteCoachEditorPayload,
} from '@/lib/athlete-coach/athlete-coach-service';
import { requireCoachAthleteFromBearer } from '@/lib/athlete-coach/require-coach-athlete';
import { coachPublicLandingUrl } from '@/lib/athlete-coach/coach-public-url';

function serializeEditor(row: AthleteCoachEditorPayload) {
  const slug = row.gofastHandle?.trim() || null;
  return {
    athleteId: row.id,
    isCoach: row.isCoach,
    athlete: {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      photoURL: row.photoURL,
      bio: row.bio,
      city: row.city,
      state: row.state,
      gofastHandle: row.gofastHandle,
    },
    profile: row.athlete_coach_profile,
    programs: row.athlete_coach_programs,
    publicCoachUrl: slug ? coachPublicLandingUrl(slug) : null,
  };
}

export async function GET(request: Request) {
  const auth = await requireCoachAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  await ensureAthleteCoachProfile(auth.athlete.id);
  const payload = await loadAthleteCoachEditorPayload(auth.athlete.id);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Coach access required' }, { status: 403 });
  }

  return NextResponse.json({ success: true, ...serializeEditor(payload) });
}

type ProfilePatch = {
  coachExperienceBio?: string | null;
  trainingFocus?: string | null;
  trainingMethod?: string | null;
  companyName?: string | null;
  discoveryCallUrl?: string | null;
  city?: string | null;
  state?: string | null;
  isPublished?: boolean;
};

export async function PATCH(request: Request) {
  const auth = await requireCoachAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let body: { profile?: ProfilePatch; athlete?: { firstName?: string; lastName?: string; bio?: string; city?: string; state?: string; photoURL?: string } } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  await ensureAthleteCoachProfile(auth.athlete.id);

  if (body.athlete) {
    const a = body.athlete;
    await prisma.athlete.update({
      where: { id: auth.athlete.id },
      data: {
        ...(a.firstName !== undefined ? { firstName: a.firstName?.trim() || null } : {}),
        ...(a.lastName !== undefined ? { lastName: a.lastName?.trim() || null } : {}),
        ...(a.bio !== undefined ? { bio: a.bio?.trim() || null } : {}),
        ...(a.city !== undefined ? { city: a.city?.trim() || null } : {}),
        ...(a.state !== undefined ? { state: a.state?.trim() || null } : {}),
        ...(a.photoURL !== undefined ? { photoURL: a.photoURL?.trim() || null } : {}),
      },
    });
  }

  if (body.profile) {
    const p = body.profile;
    await prisma.athlete_coach_profiles.update({
      where: { athleteId: auth.athlete.id },
      data: {
        ...(p.coachExperienceBio !== undefined
          ? { coachExperienceBio: p.coachExperienceBio?.trim() || null }
          : {}),
        ...(p.trainingFocus !== undefined ? { trainingFocus: p.trainingFocus?.trim() || null } : {}),
        ...(p.trainingMethod !== undefined ? { trainingMethod: p.trainingMethod?.trim() || null } : {}),
        ...(p.companyName !== undefined ? { companyName: p.companyName?.trim() || null } : {}),
        ...(p.discoveryCallUrl !== undefined
          ? { discoveryCallUrl: p.discoveryCallUrl?.trim() || null }
          : {}),
        ...(p.city !== undefined ? { city: p.city?.trim() || null } : {}),
        ...(p.state !== undefined ? { state: p.state?.trim() || null } : {}),
        ...(p.isPublished !== undefined ? { isPublished: Boolean(p.isPublished) } : {}),
      },
    });
  }

  const payload = await loadAthleteCoachEditorPayload(auth.athlete.id);
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Coach access required' }, { status: 403 });
  }

  return NextResponse.json({ success: true, ...serializeEditor(payload) });
}
