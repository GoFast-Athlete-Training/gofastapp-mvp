/** When unset or not exactly "true", weekly auto-advance and manual advance create no instances. */
export const CLUB_RUN_AUTO_ADVANCE_ENV = "CLUB_RUN_AUTO_ADVANCE";

export function isClubRunAutoAdvanceEnabled(): boolean {
  return process.env[CLUB_RUN_AUTO_ADVANCE_ENV] === "true";
}

export const CLUB_RUN_AUTO_ADVANCE_DISABLED_MESSAGE =
  "Club run auto-advance is disabled. Set CLUB_RUN_AUTO_ADVANCE=true on Product to re-enable copying prior weeks into upcoming slots.";
