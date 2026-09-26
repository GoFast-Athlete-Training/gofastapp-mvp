import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateUniqueCityRunSlug } from '@/lib/slug-utils';
import { parseRunTotalMiles } from '@/lib/parse-run-total-miles';
import { resolveCityRunType } from '@/lib/city-run-type';
import { inferRegionSlugFromCitySlug } from '@/lib/region-slug';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export type LeaderCreateRunInput = {
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  description?: string | null;
  totalMiles?: number | string | null;
  pace?: string | null;
};

export async function createCityRunForClubLeader(opts: {
  runClubId: string;
  athleteGeneratedId: string;
  input: LeaderCreateRunInput;
}) {
  const title = opts.input.title.trim();
  const meetUpPoint = opts.input.meetUpPoint.trim();
  const runDate = new Date(opts.input.date);
  if (!title || !meetUpPoint || Number.isNaN(runDate.getTime())) {
    throw new Error('title, date, and meetUpPoint are required');
  }

  const club = await prisma.run_clubs.findUnique({
    where: { id: opts.runClubId },
    select: { id: true, slug: true, city: true },
  });
  if (!club) throw new Error('Run club not found');

  const citySlug =
    club.city?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    'unknown';
  const id = generateId();
  const slug = await generateUniqueCityRunSlug(title, { date: runDate, clubSlug: club.slug });

  const run = await prisma.city_runs.create({
    data: {
      id,
      slug,
      title,
      date: runDate,
      meetUpPoint,
      meetUpCity: opts.input.meetUpCity?.trim() || null,
      meetUpState: opts.input.meetUpState?.trim() || null,
      description: opts.input.description?.trim() || null,
      totalMiles: parseRunTotalMiles(opts.input.totalMiles),
      pace: opts.input.pace?.trim() || null,
      runClubId: club.id,
      athleteGeneratedId: opts.athleteGeneratedId,
      citySlug,
      regionSlug: inferRegionSlugFromCitySlug(citySlug),
      workflowStatus: 'DEVELOP',
      published: false,
      cityRunType: resolveCityRunType({
        runClubId: club.id,
        runCrewId: null,
        athleteGeneratedId: opts.athleteGeneratedId,
      }),
      routePhotos: Prisma.JsonNull,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      date: true,
      workflowStatus: true,
      meetUpPoint: true,
      runClubId: true,
    },
  });

  return run;
}
