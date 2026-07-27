import type { ActiveBlockSnapshot } from "@/lib/advertising/block-service";
import { ProfileContainerAdBlock } from "@/components/advertising/ProfileContainerAdBlock";

type ProfileContainerAdSlotProps = {
  isGoFastContainer: boolean;
  activeBlock: ActiveBlockSnapshot | null;
};

export function ProfileContainerAdSlot({
  isGoFastContainer,
  activeBlock,
}: ProfileContainerAdSlotProps) {
  if (!isGoFastContainer || !activeBlock) return null;
  return <ProfileContainerAdBlock block={activeBlock} />;
}
