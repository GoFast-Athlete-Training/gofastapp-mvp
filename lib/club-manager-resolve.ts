import {
  AttachClubLeaderClaimError,
  attachClubLeaderClaim,
  attachClubLeaderClaimByInviteToken,
} from '@/lib/domain-runclub-leader-claim';

export async function resolveClubManagerAccessForAthlete(
  athleteId: string,
  athleteEmail: string | null | undefined,
  input: { grantId?: string; inviteToken?: string }
) {
  const grantId = input.grantId?.trim();
  const inviteToken = input.inviteToken?.trim();

  if (!grantId && !inviteToken) {
    throw new Error('inviteToken or grantId is required');
  }

  if (inviteToken) {
    return attachClubLeaderClaimByInviteToken(athleteId, athleteEmail, inviteToken);
  }
  return attachClubLeaderClaim(athleteId, athleteEmail, grantId!);
}

export { AttachClubLeaderClaimError };
