/** Path prose for the run route — city run snap or linked routes row. */
export function resolveCityRunRoutePathDescription(run: {
  workoutDescription?: string | null;
  route?: { routeDescription?: string | null } | null;
}): string | null {
  const fromRun = run.workoutDescription?.trim();
  if (fromRun) return fromRun;
  const fromRoute = run.route?.routeDescription?.trim();
  return fromRoute || null;
}

export function resolveCityRunStravaRouteUrl(run: {
  stravaMapUrl?: string | null;
  route?: { stravaMapUrl?: string | null; stravaUrl?: string | null } | null;
}): string | null {
  const direct = run.stravaMapUrl?.trim();
  if (direct) return direct;
  const linked = run.route?.stravaMapUrl?.trim() || run.route?.stravaUrl?.trim();
  return linked || null;
}
