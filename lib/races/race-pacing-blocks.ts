import { secondsPerMileToSecondsPerKm } from "@/lib/workout-generator/pace-calculator";

export type PacingStrategy = "even" | "negative" | "positive";

export type RacePacingBlock = {
  name: string;
  miles: number;
  paceSecPerMiLow: number;
  paceSecPerMiHigh: number;
  kind?: "warmup" | "main" | "push" | "cooldown";
};

export type RaceDaySegmentPayload = {
  stepOrder: number;
  title: string;
  durationType: "DISTANCE";
  durationValue: number;
  targets: Array<{ type: "PACE"; valueLow: number; valueHigh: number }>;
};

function roundMi(n: number): number {
  return Math.round(n * 100) / 100;
}

function paceBand(baseSecPerMi: number, lowFactor: number, highFactor: number) {
  const mid = baseSecPerMi;
  return {
    paceSecPerMiLow: Math.round(mid * lowFactor),
    paceSecPerMiHigh: Math.round(mid * highFactor),
  };
}

/** Coarse race plan blocks — not one row per mile. */
export function suggestRaceBlocksFromGoal(params: {
  totalMiles: number;
  goalPaceSecPerMi: number;
  strategy: PacingStrategy;
}): RacePacingBlock[] {
  const total = roundMi(params.totalMiles);
  const base = params.goalPaceSecPerMi;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(base) || base <= 0) {
    return [];
  }

  const startMi = Math.min(2, roundMi(total * 0.08));
  let remaining = roundMi(total - startMi);

  const firstHalfFactor =
    params.strategy === "negative" ? 1.03 : params.strategy === "positive" ? 0.97 : 1;
  const secondHalfFactor =
    params.strategy === "negative" ? 0.97 : params.strategy === "positive" ? 1.03 : 1;

  const half = roundMi(remaining / 2);
  const mid1 = half;
  const mid2 = roundMi(remaining - half);

  const startBand = paceBand(base, 1.06, 1.12);
  const blocks: RacePacingBlock[] = [
    {
      name: "Start — settle in",
      miles: startMi,
      ...startBand,
      kind: "warmup",
    },
    {
      name: "Early miles",
      miles: mid1,
      ...paceBand(base, firstHalfFactor * 0.99, firstHalfFactor * 1.01),
      kind: "main",
    },
    {
      name: "Middle miles",
      miles: mid2,
      ...paceBand(base, secondHalfFactor * 0.99, secondHalfFactor * 1.01),
      kind: "main",
    },
  ];

  const sum = blocks.reduce((a, b) => a + b.miles, 0);
  const drift = roundMi(total - sum);
  if (Math.abs(drift) > 0.02) {
    blocks[blocks.length - 1] = {
      ...blocks[blocks.length - 1]!,
      miles: roundMi(blocks[blocks.length - 1]!.miles + drift),
    };
  }

  return blocks;
}

export function raceBlocksToRaceDaySegments(blocks: RacePacingBlock[]): RaceDaySegmentPayload[] {
  return blocks.map((b, i) => {
    const lowKm = secondsPerMileToSecondsPerKm(b.paceSecPerMiLow);
    const highKm = secondsPerMileToSecondsPerKm(b.paceSecPerMiHigh);
    return {
      stepOrder: i + 1,
      title: b.name,
      durationType: "DISTANCE",
      durationValue: b.miles,
      targets: [
        {
          type: "PACE",
          valueLow: Math.min(lowKm, highKm),
          valueHigh: Math.max(lowKm, highKm),
        },
      ],
    };
  });
}

/** Map saved race-day segments back to editable blocks (builder preload). */
export function raceDaySegmentsToBlocks(
  segments: Array<{
    title: string;
    durationType: string;
    durationValue: number;
    targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }>;
  }>
): RacePacingBlock[] {
  return segments.map((seg) => {
    const paceTarget = seg.targets?.find((t) => String(t.type).toUpperCase() === "PACE");
    const lowKm = paceTarget?.valueLow;
    const highKm = paceTarget?.valueHigh ?? lowKm;
    const secPerKmToMi = (secKm: number) => secKm * 1.60934;
    const lowMi =
      lowKm != null && Number.isFinite(lowKm) ? Math.round(secPerKmToMi(lowKm)) : 0;
    const highMi =
      highKm != null && Number.isFinite(highKm) ? Math.round(secPerKmToMi(highKm)) : lowMi;
    return {
      name: seg.title?.trim() || "Block",
      miles: seg.durationType === "DISTANCE" ? seg.durationValue : 0,
      paceSecPerMiLow: lowMi || 480,
      paceSecPerMiHigh: highMi || lowMi || 480,
      kind: "main",
    };
  });
}
