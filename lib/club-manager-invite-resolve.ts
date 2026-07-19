import {
  AttachClubLeaderClaimError,
  resolveInviteByToken,
} from '@/lib/domain-runclub-leader-claim';
import { formatClubManagerRoleLabel } from '@/lib/club-manager-membership-roles';

export async function resolveClubManagerInviteToken(token: string) {
  const grant = await resolveInviteByToken(token);
  return {
    id: grant.claimId,
    runClubId: grant.runClubId,
    runClubSlug: grant.runClubSlug,
    runClubName: grant.runClubName,
    email: grant.email,
    membershipRole: grant.membershipRole,
    roleLabel: formatClubManagerRoleLabel(grant.membershipRole),
    status: grant.status,
    inviteExpiresAt: grant.inviteExpiresAt?.toISOString() ?? null,
  };
}

export { AttachClubLeaderClaimError };
