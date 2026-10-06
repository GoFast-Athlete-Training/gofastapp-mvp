import { suggestRaceBlocksFromGoal, type RacePacingBlock } from "@/lib/races/race-pacing-blocks";

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

function blocksToStretches(blocks: RacePacingBlock[]): GuidedRaceStretch[] {
  let mile = 0;
  return blocks.map((b, i) => {
    const start = mile;
    const end = mile + b.miles;
    mile = end;
    const effortNote =
      b.kind === "warmup"
        ? "Settle in — a little easy, then hold."
        : "Hold steady at your goal effort.";
    return {
      key: `block-${i}`,
      title: b.name,
      mileRangeLabel: `${start.toFixed(1)}–${end.toFixed(1)} mi`,
      paceBandLabel: formatPaceBand(b.paceSecPerMiLow, b.paceSecPerMiHigh),
      effortNote,
      courseNote: null,
    };
  });
}

/** Map course segments + goal pace into a race-week guide. Falls back to coarse blocks. */
export function buildGuidedRaceStretches(params: {
  segments: CourseSegmentInput[];
  totalMiles: number;
  goalPaceSecPerMi: number;
}): GuidedRaceStretch[] {
  const { segments, totalMiles, goalPaceSecPerMi } = params;
  const sorted = segments.slice().sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    const blocks = suggestRaceBlocksFromGoal({
      totalMiles,
      goalPaceSecPerMi,
      strategy: "even",
    });
    return blocksToStretches(blocks);
  }

  const settleFactor = 1.06;
  const stretches: GuidedRaceStretch[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i]!;
    const mileAt = parseMileMarker(seg.mileMarker);
    const nextMile = parseMileMarker(sorted[i + 1]?.mileMarker ?? null);
    let rangeLabel = seg.mileMarker?.trim() || `Segment ${i + 1}`;
    if (mileAt != null && nextMile != null && nextMile > mileAt) {
      rangeLabel = `${mileAt.toFixed(1)}–${nextMile.toFixed(1)} mi`;
    } else if (mileAt != null) {
      rangeLabel = `From mile ${mileAt.toFixed(1)}`;
    }

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
