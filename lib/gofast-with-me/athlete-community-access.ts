/** Pure follow/participation rules for athlete communities (no plan enrollment). */
export function athleteCommunityRelationship(params: {
  hostAthleteId: string;
  callerAthleteId: string | null;
  hasMembership: boolean;
}): {
  isOwner: boolean;
  isFollowing: boolean;
  canParticipate: boolean;
} {
  const { hostAthleteId, callerAthleteId, hasMembership } = params;
  if (!callerAthleteId) {
    return { isOwner: false, isFollowing: false, canParticipate: false };
  }
  if (callerAthleteId === hostAthleteId) {
    return { isOwner: true, isFollowing: false, canParticipate: true };
  }
  return {
    isOwner: false,
    isFollowing: hasMembership,
    canParticipate: hasMembership,
  };
}

/** Owner preview mode hides owner affordances without granting follower permissions. */
export function applyFollowerPreviewMode(
  relationship: {
    isOwner: boolean;
    isFollowing: boolean;
    canParticipate: boolean;
  },
  previewFollower: boolean
): {
  displayAsOwner: boolean;
  displayAsFollower: boolean;
  canParticipate: boolean;
} {
  if (!relationship.isOwner || !previewFollower) {
    return {
      displayAsOwner: relationship.isOwner,
      displayAsFollower: relationship.isFollowing,
      canParticipate: relationship.canParticipate,
    };
  }
  return {
    displayAsOwner: false,
    displayAsFollower: false,
    canParticipate: false,
  };
}
