/** Legacy env name — advance is always on; unpublished slots from last run meta (no route). */
export const CLUB_RUN_AUTO_ADVANCE_ENV = "CLUB_RUN_AUTO_ADVANCE";

export function isClubRunAutoAdvanceEnabled(): boolean {
  return true;
}

export const CLUB_RUN_AUTO_ADVANCE_DISABLED_MESSAGE =
  "Club run auto-advance is temporarily unavailable.";
