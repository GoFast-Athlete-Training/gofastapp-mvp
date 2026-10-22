import { Prisma } from '@prisma/client';
import { GOFAST_COMPANY_ID } from '@/lib/goFastCompanyConfig';
import {
  normalizeAthleteEmail,
  splitDisplayName,
} from '@/lib/athlete-email-normalize';
import { prisma } from '@/lib/prisma';
import { RSVP_ROLE_GOING } from '@/lib/city-run/rsvp-role';
import { upsertCityRunStampForAthlete } from '@/lib/city-run/city-run-stamp';
import { upsertIndividualCityRunStampForAthlete } from '@/lib/city-run/individual-city-run-stamp';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

async function resolveGoFastCompanyId(): Promise<string> {
  const configured = await prisma.go_fast_companies.findUnique({
    where: { id: GOFAST_COMPANY_ID },
    select: { id: true },
  });
  if (configured) return configured.id;
  const first = await prisma.go_fast_companies.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!first) {
    throw new Error('No GoFast company row');
  }
  return first.id;
}

export type PublicNameRsvpInput = {
  runId: string;
  displayName: string;
  email: string;
};

export type PublicNameRsvpResult =
  | { ok: true; athleteId: string; alreadyOnRun: boolean }
  | { ok: false; error: string; status: number };

/**
 * Name + email stamp on the public slice — no Firebase. One athlete per normalized email.
 */
export async function publicNameEmailCityRunRsvp(
  input: PublicNameRsvpInput,
): Promise<PublicNameRsvpResult> {
  const normalizedEmail = normalizeAthleteEmail(input.email);
  if (!normalizedEmail) {
    return { ok: false, error: 'Valid email required', status: 400 };
  }
  const { firstName, lastName } = splitDisplayName(input.displayName);
  if (!firstName.trim()) {
    return { ok: false, error: 'Name required', status: 400 };
  }

  const run = await prisma.city_runs.findUnique({
    where: { id: input.runId },
    select: {
      id: true,
      runClubId: true,
      cityRunType: true,
      published: true,
      workflowStatus: true,
    },
  });
  if (!run) {
    return { ok: false, error: 'CityRun not found', status: 404 };
  }

  const companyId = await resolveGoFastCompanyId();

  let athlete = await prisma.athlete.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, firebaseId: true, photoURL: true },
  });

  if (!athlete) {
    athlete = await prisma.athlete.create({
      data: {
        id: generateId(),
        firebaseId: null,
        email: normalizedEmail,
        firstName,
        lastName,
        companyId,
        updatedAt: new Date(),
      },
      select: { id: true, firebaseId: true, photoURL: true },
    });
  } else {
    const patch: Prisma.AthleteUpdateInput = { updatedAt: new Date() };
    if (!athlete.photoURL) {
      patch.firstName = firstName;
      patch.lastName = lastName;
    }
    if (Object.keys(patch).length > 1) {
      athlete = await prisma.athlete.update({
        where: { id: athlete.id },
        data: patch,
        select: { id: true, firebaseId: true, photoURL: true },
      });
    }
  }

  const existingRsvp = await prisma.city_run_rsvps.findUnique({
    where: { runId_athleteId: { runId: input.runId, athleteId: athlete.id } },
    select: { status: true, role: true },
  });

  if (existingRsvp?.status === 'going') {
    return { ok: true, athleteId: athlete.id, alreadyOnRun: true };
  }

  await prisma.city_run_rsvps.upsert({
    where: { runId_athleteId: { runId: input.runId, athleteId: athlete.id } },
    update: { status: 'going', role: RSVP_ROLE_GOING },
    create: {
      id: generateId(),
      runId: input.runId,
      athleteId: athlete.id,
      status: 'going',
      role: RSVP_ROLE_GOING,
      rsvpPhotoUrls: Prisma.JsonNull,
    },
  });

  if (run.runClubId) {
    await upsertCityRunStampForAthlete(athlete.id, input.runId, {});
  } else if (run.cityRunType === 'INDIVIDUAL') {
    await upsertIndividualCityRunStampForAthlete(athlete.id, input.runId);
  }

  return { ok: true, athleteId: athlete.id, alreadyOnRun: false };
}
