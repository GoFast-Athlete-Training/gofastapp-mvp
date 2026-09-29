/**
 * Series vs instance context for building dated run copy — avoid duplicating series facts on city_runs.
 */

export type RunSeriesContext = {
  dayOfWeek?: string | null;
  meetUpPoint?: string | null;
  totalMiles?: string | number | null;
  routeNeighborhood?: string | null;
  workoutDescription?: string | null;
  postRunActivity?: string | null;
  pace?: string | null;
};

export type RunInstanceContext = {
  dateYmd?: string | null;
  meetUpPoint?: string | null;
  endPoint?: string | null;
  totalMiles?: string | number | null;
  pace?: string | null;
  postRunActivity?: string | null;
  /** Freeform route path for this date — e.g. "down Wilson before cutting north" */
  routeNotes?: string | null;
  /** Route/area context (e.g. Ballston) — optional AI context, not the path itself. */
  routeNeighborhood?: string | null;
  /** Run type slug (e.g. neighborhood) — description source input on manage edit. */
  runType?: string | null;
  directionsText?: string | null;
  weatherNote?: string | null;
  mapImageUrl?: string | null;
  stravaEventUrl?: string | null;
  stravaText?: string | null;
  existingDescription?: string | null;
};

export type InstanceDescriptionHints = {
  routeNotes?: string | null;
  routeNeighborhood?: string | null;
  postRunActivity?: string | null;
  endPoint?: string | null;
  totalMiles?: string | number | null;
  pace?: string | null;
};

/** Short local draft from instance-specific facts — never copies series overview. */
export function composeInstanceDescriptionDraft(
  hints: InstanceDescriptionHints
): string | null {
  const parts: string[] = [];

  const routeNotes = hints.routeNotes?.trim();
  const area = hints.routeNeighborhood?.trim();
  if (routeNotes) {
    parts.push(routeNotes.endsWith(".") ? routeNotes : `${routeNotes}.`);
  } else if (area) {
    parts.push(`Route through ${area}.`);
  }

  const miles =
    hints.totalMiles != null && String(hints.totalMiles).trim() !== ""
      ? String(hints.totalMiles).trim()
      : null;
  if (miles) {
    parts.push(`${miles} mi.`);
  }

  const end = hints.endPoint?.trim();
  const postRun = hints.postRunActivity?.trim();
  if (postRun && end) {
    parts.push(`Finish at ${end} for ${postRun}.`);
  } else if (postRun) {
    parts.push(`After the run: ${postRun}.`);
  } else if (end) {
    parts.push(`Finish at ${end}.`);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

/** Format read-only series baseline for the builder UI. */
export function formatSeriesContextSummary(ctx: RunSeriesContext): string[] {
  const lines: string[] = [];
  if (ctx.totalMiles != null && String(ctx.totalMiles).trim() !== "") {
    lines.push(`Typically ${ctx.totalMiles} mi`);
  }
  if (ctx.meetUpPoint?.trim()) {
    lines.push(`Leaves from ${ctx.meetUpPoint.trim()}`);
  }
  if (ctx.routeNeighborhood?.trim()) {
    lines.push(`Route area: ${ctx.routeNeighborhood.trim()}`);
  }
  if (ctx.workoutDescription?.trim()) {
    lines.push(`Workout: ${ctx.workoutDescription.trim()}`);
  }
  if (ctx.postRunActivity?.trim()) {
    lines.push(`Usually after: ${ctx.postRunActivity.trim()}`);
  }
  return lines;
}
