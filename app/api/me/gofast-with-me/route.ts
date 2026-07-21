export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  buildGoFastWithMeUrl,
  ensureGoFastWithMeForAthlete,
  getGoFastWithMeForAthlete,
  setGoFastWithMeSlug,
  updateGoFastWithMeIntro,
  useGoFastHandleForUrl,
} from '@/lib/gofast-with-me/gofast-with-me-service';

/** GET /api/me/gofast-with-me — own GoFast With Me row */
export async function GET(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const handle = athlete.gofastHandle?.trim();
    if (!handle) {
      return NextResponse.json({
        success: true,
        hasHandle: false,
        gofastWithMe: null,
      });
    }

    let gofastWithMe = await getGoFastWithMeForAthlete(athlete.id);
    if (!gofastWithMe) {
      await ensureGoFastWithMeForAthlete(athlete.id, handle, {
        seedBioFromAthlete: athlete.bio,
        seedPhotoFromAthlete: athlete.myBestRunPhotoURL,
      });
      gofastWithMe = await getGoFastWithMeForAthlete(athlete.id);
    }

    return NextResponse.json({
      success: true,
      hasHandle: true,
      gofastWithMe,
      publicSlug: gofastWithMe?.gofastSlugSnapshot ?? null,
      publicUrl: gofastWithMe
        ? buildGoFastWithMeUrl(gofastWithMe.gofastSlugSnapshot)
        : null,
      gofastHandle: handle,
    });
  } catch (e) {
    console.error('GET /api/me/gofast-with-me', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

const INTRO_FIELDS = [
  'welcome',
  'gofastWithMeBio',
  'whatYoullSeeHere',
  'sportFocus',
  'modelFocus',
  'myAchievements',
  'gofastWithMePhotoUrl',
  'gofastWithMePhotoType',
  'creatorType',
  'coachSpecialty',
] as const;

/** PATCH /api/me/gofast-with-me — update intro fields and/or URL settings */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const handle = athlete.gofastHandle?.trim();
    if (!handle) {
      return NextResponse.json(
        { success: false, error: 'Set your handle before editing GoFast With Me' },
        { status: 400 }
      );
    }

    await ensureGoFastWithMeForAthlete(athlete.id, handle, {
      seedBioFromAthlete: athlete.bio,
    });

    const body = await request.json();

    if (body.useGofastHandle === true) {
      const gofastWithMe = await useGoFastHandleForUrl(athlete.id, handle);
      return NextResponse.json({
        success: true,
        gofastWithMe,
        publicUrl: buildGoFastWithMeUrl(gofastWithMe.gofastSlugSnapshot),
      });
    }

    if (body.customSlug != null && String(body.customSlug).trim() !== '') {
      const gofastWithMe = await setGoFastWithMeSlug(athlete.id, String(body.customSlug));
      return NextResponse.json({
        success: true,
        gofastWithMe,
        publicUrl: buildGoFastWithMeUrl(gofastWithMe.gofastSlugSnapshot),
      });
    }

    const introPatch: Record<string, string | null> = {};
    for (const field of INTRO_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        introPatch[field] =
          body[field] == null || body[field] === '' ? null : String(body[field]);
      }
    }

    if (Object.keys(introPatch).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Provide intro fields (welcome, gofastWithMeBio, whatYoullSeeHere, sportFocus, modelFocus, myAchievements, gofastWithMePhotoUrl, gofastWithMePhotoType, creatorType, coachSpecialty), customSlug, or useGofastHandle',
        },
        { status: 400 }
      );
    }

    const gofastWithMe = await updateGoFastWithMeIntro(athlete.id, introPatch);
    return NextResponse.json({
      success: true,
      gofastWithMe,
      publicUrl: buildGoFastWithMeUrl(gofastWithMe.gofastSlugSnapshot),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    console.error('PATCH /api/me/gofast-with-me', e);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
