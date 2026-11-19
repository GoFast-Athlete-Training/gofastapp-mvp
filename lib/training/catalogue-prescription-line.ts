export type CataloguePrescriptionInput = {
  paceAnchor?: string | null;
  segmentPaceDist?: unknown;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  workBaseMiles?: number | null;
  workBasePaceOffsetSecPerMile?: number | null;
  workPaceOffsetSecPerMile?: number | null;
  recoveryDistanceMeters?: number | null;
  recoveryDurationSeconds?: number | null;
  recoveryPaceOffsetSecPerMile?: number | null;
};

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function signedSeconds(offset: number): string {
  const n = Math.round(offset);
  return n > 0 ? `+${n}` : String(n);
}

function paceVersus(anchor: string | null | undefined): string {
  return anchor === "goalRacePace" || anchor === "mpSimulation" ? "goal pace" : "5K";
}

function paceLabel(offset: number | null, anchor: string | null | undefined): string | null {
  if (offset == null) return null;
  return `${signedSeconds(offset)}s vs ${paceVersus(anchor)}`;
}

function recoveryLabel(row: CataloguePrescriptionInput): string | null {
  const seconds = finite(row.recoveryDurationSeconds);
  if (seconds != null && seconds > 0) return `${Math.round(seconds)}s recovery`;
  const meters = finite(row.recoveryDistanceMeters);
  if (meters != null && meters > 0) return `${Math.round(meters)}m recovery`;
  return null;
}

function sharedOffset(offsets: Array<number | null>): number | null {
  const present = offsets.filter((offset): offset is number => offset != null);
  if (present.length === 0) return null;
  const first = present[0]!;
  return present.every((offset) => offset === first) ? first : null;
}

type WorkBit = { label: string; offset: number | null };

function workBits(segments: unknown[]): WorkBit[] {
  const bits: WorkBit[] = [];
  for (const segment of segments) {
    if (segment == null || typeof segment !== "object" || Array.isArray(segment)) continue;
    const row = segment as {
      distanceMeters?: unknown;
      miles?: unknown;
      reps?: unknown;
      paceOffsetSecPerMile?: unknown;
    };
    const repsRaw = finite(row.reps);
    const reps = repsRaw != null && repsRaw > 0 ? Math.max(1, Math.round(repsRaw)) : 1;
    const meters = finite(row.distanceMeters);
    const miles = finite(row.miles);
    let body: string | null = null;
    if (meters != null && meters > 0) {
      const dist = `${Math.round(meters)}m`;
      body = reps > 1 ? `${reps}×${dist}` : dist;
    } else if (miles != null && miles > 0) {
      const dist = `${Math.round(miles * 10) / 10} mi`;
      body = reps > 1 ? `${reps}×${dist}` : dist;
    }
    if (!body) continue;
    const offset = finite(row.paceOffsetSecPerMile);
    bits.push({ label: body, offset });
  }
  return bits;
}

function joinWork(bits: WorkBit[], anchor: string | null | undefined): string[] {
  if (bits.length === 0) return [];
  const shared = sharedOffset(bits.map((bit) => bit.offset));
  if (shared != null || bits.every((bit) => bit.offset == null)) {
    return bits.map((bit) => bit.label);
  }
  return bits.map((bit) =>
    bit.offset == null ? bit.label : `${bit.label} (${signedSeconds(bit.offset)}s vs ${paceVersus(anchor)})`,
  );
}

function fromSegmentPace(row: CataloguePrescriptionInput): { pieces: string[]; recovery: string | null; offset: number | null } | null {
  const pace = row.segmentPaceDist;
  if (pace != null && typeof pace === "object" && !Array.isArray(pace)) {
    const block = pace as {
      layout?: unknown;
      segments?: unknown;
      repeatCount?: unknown;
      recoveryBetweenCyclesSeconds?: unknown;
    };
    if (block.layout !== "blockRepeat" || !Array.isArray(block.segments)) return null;
    const bits = workBits(block.segments);
    if (bits.length === 0) return null;
    const repeatRaw = finite(block.repeatCount);
    const repeat = repeatRaw != null && repeatRaw >= 1 ? Math.round(repeatRaw) : 1;
    const body = joinWork(bits, row.paceAnchor).join(" + ");
    const pieces = [repeat > 1 ? `${body} × ${repeat}` : body];
    const between = finite(block.recoveryBetweenCyclesSeconds);
    const recovery =
      between != null && between > 0 ? `${Math.round(between)}s recovery` : recoveryLabel(row);
    const segmentOffsets = bits.map((bit) => bit.offset);
    return {
      pieces,
      recovery,
      offset: segmentOffsets.some((offset) => offset != null)
        ? sharedOffset(segmentOffsets)
        : finite(row.workBasePaceOffsetSecPerMile),
    };
  }
  if (!Array.isArray(pace) || pace.length === 0) return null;
  const bits = workBits(pace);
  if (bits.length === 0) return null;
  const segmentOffsets = bits.map((bit) => bit.offset);
  return {
    pieces: joinWork(bits, row.paceAnchor),
    recovery: recoveryLabel(row),
    offset: segmentOffsets.some((offset) => offset != null)
      ? sharedOffset(segmentOffsets)
      : finite(row.workBasePaceOffsetSecPerMile),
  };
}

/** One coach-readable line from the catalogue row. Null when the row has no work to describe. */
export function cataloguePrescriptionLine(row: CataloguePrescriptionInput | null | undefined): string | null {
  if (!row) return null;
  const fromSegments = fromSegmentPace(row);
  const pieces = fromSegments?.pieces ?? [];
  let recovery = fromSegments?.recovery ?? null;
  let offset = fromSegments?.offset ?? null;

  if (pieces.length === 0) {
    const reps = finite(row.workBaseReps);
    const meters = finite(row.workBaseRepMeters);
    if (reps != null && reps > 0 && meters != null && meters > 0) {
      pieces.push(`${Math.round(reps)}×${Math.round(meters)}m`);
    } else {
      const miles = finite(row.workBaseMiles);
      if (miles != null && miles > 0) pieces.push(`${Math.round(miles * 10) / 10} mi`);
    }
    recovery = recoveryLabel(row);
    offset = finite(row.workBasePaceOffsetSecPerMile) ?? finite(row.workPaceOffsetSecPerMile);
  }

  if (pieces.length === 0) return null;
  const bits = [...pieces];
  if (recovery) bits.push(recovery);
  const pace = paceLabel(offset, row.paceAnchor);
  if (pace) bits.push(pace);
  return bits.join(" · ");
}

/** Count repeated materialized titles instead of listing every Interval and Recovery. */
export function collapsedSegmentTitles(segments: { title: string }[]): string | null {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const segment of segments) {
    const title = segment.title.trim();
    if (!title) continue;
    if (!counts.has(title)) order.push(title);
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  if (order.length === 0) return null;
  return order
    .map((title) => {
      const count = counts.get(title) ?? 1;
      return count > 1 ? `${title} × ${count}` : title;
    })
    .join(" · ");
}
