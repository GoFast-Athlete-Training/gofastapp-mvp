type ClubMetaInput = {
  description?: string | null;
  allRunsDescription?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  stravaUrl?: string | null;
};

export type SetupCompleteness = {
  metaComplete: boolean;
  metaMissing: string[];
  hasSeries: boolean;
  hasUpcomingRuns: boolean;
  runsNeedReview: number;
  readyForMembers: boolean;
};

function hasText(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

export function computeSetupCompleteness(input: {
  club: ClubMetaInput;
  seriesCount: number;
  upcomingRunCount: number;
  runsNeedReview: number;
}): SetupCompleteness {
  const metaMissing: string[] = [];
  if (!hasText(input.club.description)) metaMissing.push('Club description');
  if (!hasText(input.club.allRunsDescription)) metaMissing.push('All runs description');
  if (!hasText(input.club.logoUrl)) metaMissing.push('Logo');
  if (!hasText(input.club.websiteUrl) && !hasText(input.club.instagramUrl)) {
    metaMissing.push('Website or Instagram');
  }

  const metaComplete = metaMissing.length === 0;
  const hasSeries = input.seriesCount > 0;
  const hasUpcomingRuns = input.upcomingRunCount > 0;

  return {
    metaComplete,
    metaMissing,
    hasSeries,
    hasUpcomingRuns,
    runsNeedReview: input.runsNeedReview,
    readyForMembers: metaComplete && hasSeries && hasUpcomingRuns,
  };
}
