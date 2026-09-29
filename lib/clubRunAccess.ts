/** Staff triage: block public run instance creation / seeding. */
export type ClubRunAccessInput = {
  membershipType?: string | null;
  runsRequireMembership?: boolean | null;
};

export function blocksPublicRunCreation(club: ClubRunAccessInput): boolean {
  return Boolean(club.runsRequireMembership);
}

export function clubMembershipBlockedLabel(club: ClubRunAccessInput): string {
  if (club.runsRequireMembership) {
    return "Member-only runs — public run creation blocked";
  }
  if (club.membershipType === "PAID") {
    return "Membership club with public runs — eligible for public run work";
  }
  return "Open club — eligible for public run work";
}
