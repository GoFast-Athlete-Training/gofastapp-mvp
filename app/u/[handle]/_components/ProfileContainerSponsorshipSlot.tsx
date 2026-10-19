import type { ActiveCommitmentSnapshot } from "@/lib/sponsorship/commitment-service";
import { ProfileContainerSponsorshipBlock } from "@/components/sponsorship/ProfileContainerSponsorshipBlock";

type ProfileContainerSponsorshipSlotProps = {
  activeSponsorship: ActiveCommitmentSnapshot | null;
};

export function ProfileContainerSponsorshipSlot({
  activeSponsorship,
}: ProfileContainerSponsorshipSlotProps) {
  if (!activeSponsorship) return null;
  return <ProfileContainerSponsorshipBlock commitment={activeSponsorship} />;
}
