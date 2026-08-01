import type { ActiveCommitmentSnapshot } from "@/lib/sponsorship/commitment-service";
import { ProfileContainerSponsorshipBlock } from "@/components/sponsorship/ProfileContainerSponsorshipBlock";

type ProfileContainerSponsorshipSlotProps = {
  isGoFastContainer: boolean;
  activeSponsorship: ActiveCommitmentSnapshot | null;
};

export function ProfileContainerSponsorshipSlot({
  isGoFastContainer,
  activeSponsorship,
}: ProfileContainerSponsorshipSlotProps) {
  if (!isGoFastContainer || !activeSponsorship) return null;
  return <ProfileContainerSponsorshipBlock commitment={activeSponsorship} />;
}
