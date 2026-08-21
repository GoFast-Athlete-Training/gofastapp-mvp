/** Post-signup destination for GoFast Amateur Athlete Program landing funnel. */
export const ATHLETE_PROGRAM_DESTINATION = '/gofast-with-others';

export const ATHLETE_PROGRAM_SIGNUP_PATH = '/athlete-program/signup';

export function athleteProgramProfileCreatePath(): string {
  return `/athlete-create-profile?redirect=${encodeURIComponent(ATHLETE_PROGRAM_DESTINATION)}`;
}
