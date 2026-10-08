import type { CityRunType, ClubReviewStatus } from '@prisma/client';

export const CLUB_REVIEW_STATUSES = [
  'draft',
  'pending_club_review',
  'verified',
] as const satisfies readonly ClubReviewStatus[];

export type ClubReviewStatusValue = (typeof CLUB_REVIEW_STATUSES)[number];

export function isClubReviewStatus(value: string): value is ClubReviewStatusValue {
  return (CLUB_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function clubRunRequiresVerifiedReview(cityRunType: CityRunType | string | null | undefined): boolean {
  return cityRunType === 'CLUB';
}

export function assertClubRunVerifiedForPublish(run: {
  cityRunType?: CityRunType | string | null;
  clubReviewStatus?: ClubReviewStatus | string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!clubRunRequiresVerifiedReview(run.cityRunType)) {
    return { ok: true };
  }
  if (run.clubReviewStatus === 'verified') {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      'Club runs must be club-verified before publish. Set clubReviewStatus to verified (or mark with club for review first).',
  };
}
