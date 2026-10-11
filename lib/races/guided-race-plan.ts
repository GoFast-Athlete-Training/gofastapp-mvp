export type CourseSegmentInput = {
  order: number;
  name: string;
  mileMarker?: string | null;
  description?: string | null;
  runTip?: string | null;
};

export type GuidedRaceStretch = {
  key: string;
  title: string;
  mileRangeLabel: string;
  paceBandLabel: string;
  effortNote: string;
  courseNote: string | null;
};

function formatSecPerMile(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function formatPaceBand(low: number, high: number): string {
  if (Math.abs(low - high) < 2) return formatSecPerMile(low);
  return `${formatSecPerMile(low)} – ${formatSecPerMile(high)}`;
}

function parseMileMarker(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

function mileRangeLabel(
  seg: CourseSegmentInput,
  index: number,
  sorted: CourseSegmentInput[]
): string {
  const raw = seg.mileMarker?.trim();
  const embeddedRange = raw?.match(/^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)$/);
  if (embeddedRange) {
    return `${embeddedRange[1]}–${embeddedRange[2]} mi`;
  }

  const mileAt = parseMileMarker(seg.mileMarker);
  const nextMile = parseMileMarker(sorted[index + 1]?.mileMarker ?? null);
  if (mileAt != null && nextMile != null && nextMile > mileAt) {
    return `${mileAt.toFixed(1)}–${nextMile.toFixed(1)} mi`;
  }
  if (mileAt != null) {
    return `From mile ${mileAt.toFixed(1)}`;
  }
  return raw || `Segment ${index + 1}`;
}

/** Map course segments + goal pace into a race-week guide (course segments only). */
export function buildGuidedRaceStretches(params: {
  segments: CourseSegmentInput[];
  totalMiles: number;
  goalPaceSecPerMi: number;
}): GuidedRaceStretch[] {
  const { segments, goalPaceSecPerMi } = params;
  const sorted = segments.slice().sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return buildEvenPaceMileStretches(params.totalMiles, goalPaceSecPerMi);
  }

  const settleFactor = 1.06;
  const stretches: GuidedRaceStretch[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i]!;
    const rangeLabel = mileRangeLabel(seg, i, sorted);

    const isFirst = i === 0;
    const low = Math.round(goalPaceSecPerMi * (isFirst ? settleFactor : 0.99));
    const high = Math.round(goalPaceSecPerMi * (isFirst ? settleFactor + 0.02 : 1.01));

    stretches.push({
      key: `seg-${seg.order}-${i}`,
      title: seg.name,
      mileRangeLabel: rangeLabel,
      paceBandLabel: formatPaceBand(low, high),
      effortNote: isFirst ? "Ease in, then settle at goal effort." : "Hold your goal pace band.",
      courseNote: seg.runTip?.trim() || seg.description?.trim() || null,
    });
  }
  return stretches;
}

/** Even-pace mile targets when no course guide segments are mirrored yet. */
export function buildEvenPaceMileStretches(
  totalMiles: number,
  goalPaceSecPerMi: number
): GuidedRaceStretch[] {
  if (!Number.isFinite(totalMiles) || totalMiles <= 0 || !Number.isFinite(goalPaceSecPerMi)) {
    return [];
  }
  const stretches: GuidedRaceStretch[] = [];
  let offset = 0;
  let mileNum = 0;
  const eps = 1e-6;
  while (offset + eps < totalMiles) {
    const remaining = totalMiles - offset;
    const len = remaining >= 1 ? 1 : remaining;
    mileNum += 1;
    const isLast = remaining <= 1 + eps;
    const label =
      isLast && len < 1 - eps
        ? `Finish (${len.toFixed(2)} mi)`
        : `Mile ${mileNum}`;
    const low = Math.round(goalPaceSecPerMi * 0.99);
    const high = Math.round(goalPaceSecPerMi * 1.01);
    stretches.push({
      key: `even-${mileNum}`,
      title: label,
      mileRangeLabel: `${offset.toFixed(1)}–${(offset + len).toFixed(1)} mi`,
      paceBandLabel: formatPaceBand(low, high),
      effortNote: "Hold steady at goal effort.",
      courseNote: null,
    });
    offset += len;
  }
  return stretches;
}
