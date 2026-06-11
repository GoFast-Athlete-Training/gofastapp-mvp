import { findCityRunPostRunShoutCta, type CityRunPostRunShoutCta } from './city-run-post-run-shout';
import { tryMatchActivityToCityRun } from './try-match-activity-to-city-run';

export type CtaTriggerSource =
  | 'garmin-activity-ingest'
  | 'city-run-checkin'
  | 'home-read'
  | 'runs-read';

export type AthleteCtaTriggerResult = {
  cityRunPostRunShoutCta: CityRunPostRunShoutCta | null;
  activityCityRunLink?: { linked: boolean; cityRunId?: string };
};

export async function evaluateAthleteCtaTriggers(input: {
  athleteId: string;
  source: CtaTriggerSource;
  activityId?: string;
}): Promise<AthleteCtaTriggerResult> {
  let activityCityRunLink: { linked: boolean; cityRunId?: string } | undefined;

  if (input.activityId && input.source === 'garmin-activity-ingest') {
    activityCityRunLink = await tryMatchActivityToCityRun(input.activityId);
  }

  const cityRunPostRunShoutCta = await findCityRunPostRunShoutCta(input.athleteId);

  return {
    cityRunPostRunShoutCta,
    activityCityRunLink,
  };
}

export { tryMatchActivityToCityRun } from './try-match-activity-to-city-run';
export type { CityRunPostRunShoutCta } from './city-run-post-run-shout';
