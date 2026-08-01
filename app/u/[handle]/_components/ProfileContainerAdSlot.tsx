import type { ActiveCommitmentSnapshot } from "@/lib/sponsorship/commitment-service";
import { ProfileContainerSponsorshipBlock } from "@/components/sponsorship/ProfileContainerSponsorshipBlock";

type ProfileContainerAdSlotProps = {
  isGoFastContainer: boolean;
  activeBlock: ActiveCommitmentSnapshot | null;
};

/** @deprecated Use ProfileContainerSponsorshipSlot */
export function ProfileContainerAdSlot({
  isGoFastContainer,
  activeBlock,
}: ProfileContainerAdSlotProps) {
  if (!isGoFastContainer || !activeBlock) return null;
  return <ProfileContainerSponsorshipBlock commitment={activeBlock} />;
}
