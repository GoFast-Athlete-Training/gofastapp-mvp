type ClubMetaInput = {
  description?: string | null;
  allRunsDescription?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  stravaUrl?: string | null;
};

export type SetupCompleteness = {
  coreComplete: boolean;
  socialsComplete: boolean;
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
  const coreMissing: string[] = [];
  if (!hasText(input.club.description)) coreMissing.push('Club description');
  if (!hasText(input.club.allRunsDescription)) coreMissing.push('All runs description');
  if (!hasText(input.club.logoUrl)) coreMissing.push('Logo');

  const socialsComplete =
    hasText(input.club.websiteUrl) || hasText(input.club.instagramUrl);
  const socialsMissing = socialsComplete ? [] : ['Website or Instagram'];

  const coreComplete = coreMissing.length === 0;
  const metaMissing = [...coreMissing, ...socialsMissing];
  const metaComplete = coreComplete && socialsComplete;
  const hasSeries = input.seriesCount > 0;
  const hasUpcomingRuns = input.upcomingRunCount > 0;

  return {
    coreComplete,
    socialsComplete,
    metaComplete,
    metaMissing,
    hasSeries,
    hasUpcomingRuns,
    runsNeedReview: input.runsNeedReview,
    readyForMembers: metaComplete && hasSeries && hasUpcomingRuns,
  };
}
