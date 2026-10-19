import type { ActiveCommitmentSnapshot } from "@/lib/sponsorship/commitment-service";
import { ProfileContainerSponsorshipBlock } from "@/components/sponsorship/ProfileContainerSponsorshipBlock";

type ProfileContainerAdSlotProps = {
  activeBlock: ActiveCommitmentSnapshot | null;
};

/** @deprecated Use ProfileContainerSponsorshipSlot */
export function ProfileContainerAdSlot({ activeBlock }: ProfileContainerAdSlotProps) {
  if (!activeBlock) return null;
  return <ProfileContainerSponsorshipBlock commitment={activeBlock} />;
}
