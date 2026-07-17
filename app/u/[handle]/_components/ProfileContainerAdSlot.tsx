import {
  fetchServedCampaignForSurface,
  getAdvertiserImpressionsRegisterUrl,
} from "@/lib/advertising/advertiser-platform-client";
import { PublicSurfaceAdPlacement } from "@/components/advertising/PublicSurfaceAdPlacement";

type ProfileContainerAdSlotProps = {
  handle: string;
  isGoFastContainer: boolean;
};

export async function ProfileContainerAdSlot({
  handle,
  isGoFastContainer,
}: ProfileContainerAdSlotProps) {
  if (!isGoFastContainer) return null;

  const destinationKey = handle.trim().toLowerCase();
  const [creative, registerUrl] = await Promise.all([
    fetchServedCampaignForSurface({
      surfaceType: "PROFILE_CONTAINER",
      destinationKey,
    }),
    Promise.resolve(getAdvertiserImpressionsRegisterUrl()),
  ]);

  if (!creative || !registerUrl) return null;

  return <PublicSurfaceAdPlacement creative={creative} registerUrl={registerUrl} />;
}
