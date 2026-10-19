/** Post-signup destination for GoFast Amateur Athlete Program landing funnel. */
import { CONTENT_BUILDER_PATH } from '@/lib/athlete/community-nav';

export const ATHLETE_PROGRAM_DESTINATION = CONTENT_BUILDER_PATH;

export const ATHLETE_PROGRAM_SIGNUP_PATH = '/athlete-program/signup';

export function athleteProgramProfileCreatePath(): string {
  return `/athlete-create-profile?redirect=${encodeURIComponent(ATHLETE_PROGRAM_DESTINATION)}`;
}
