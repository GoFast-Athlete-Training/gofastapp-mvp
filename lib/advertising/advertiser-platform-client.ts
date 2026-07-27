/**
 * Legacy remote serve client — retired after Prod local Block hydration (Pass 3).
 * Kept as a no-op stub so older imports fail softly during cutover.
 */
export async function fetchServedCampaignForSurface(_input: {
  surfaceType: "PROFILE_CONTAINER" | "CLUB_PAGE";
  destinationKey: string;
}): Promise<null> {
  return null;
}

export function getAdvertiserImpressionsRegisterUrl(): null {
  return null;
}
